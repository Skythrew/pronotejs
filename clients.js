const uuid4 = require("uuid4");
const { PronoteAPIError } = require("./exceptions");
const { Communication, Encryption } = require("./pronoteAPI");


class ClientBase {
    constructor(pronote_url, username = "", password = "", ent = null, qr_code = false) {
        console.log("INIT");
        if (!(password.length + username.length)) {
            throw new PronoteAPIError(
                "Please provide login credentials. Cookies are None, and username and password are empty."
            );
        }

        this.ent = ent;
        let cookies = null;
        if (ent) {
            pronote_url = pronote_url.replace("login=true", "");
             cookies = ent(username, password);
        } else {
             cookies = null;
        }

        this.uuid = uuid4().toString();
        this.mobile = qr_code;

        this.username = username;
        this.password = password;
        this.pronote_url = pronote_url;
        this.communication = new Communication(pronote_url, cookies, this);
         this.communication.initialise().then((initializeResult) => {
        this.attributes = initializeResult[0];
        this.func_options = initializeResult[1];
        
        this.encryption = new Encryption();
        this.encryption.aes_iv = this.communication.encryption.aes_iv;
        

        this._last_ping = Date.now();

        this.parametres_utilisateur = {};
        this.auth_cookie = {};
        
        this.info = ClientInfo
  
        this.start_day = new Date(
            this.func_options.donneesSec.donnees.General.PremierLundi.V
        ).toLocaleDateString();
        this.week = this.get_week(new Date());

        this._refreshing = false;

        this.periods_ = null;
        this.periods_ = this.periods;
        this.logged_in = this._login();
        this._expired = false;
         }).catch((err) => {
        console.error(err);
        });
    }

    static qrcode_login(qr_code, pin) {
        const encryption = new Encryption();
        encryption.aes_set_key(pin.toString());

        const short_token = Buffer.from(qr_code.login, "hex");
        const long_token = Buffer.from(qr_code.jeton, "hex");

        let login, jeton;
        try {
            login = encryption.aes_decrypt(short_token).toString();
            jeton = encryption.aes_decrypt(long_token).toString();
        } catch (ex) {
            ex.message +=
                "exception happened during login -> probably the confirmation code is not valid";
            throw ex;
        }

        const url = qr_code.url.replace(/(\?.*)|( *)$/, "?login=true");

        return new this(url, login, jeton, true);
    }

    _login() {
        if (this.ent) {
            this.username = this.attributes.e;
            this.password = this.attributes.f;
        }

        const ident_json = {
            genreConnexion: 0,
            genreEspace: parseInt(this.attributes.a),
            identifiant: this.username,
            pourENT: this.ent ? true : false,
            enConnexionAuto: false,
            demandeConnexionAuto: false,
            demandeConnexionAppliMobile: this.mobile,
            demandeConnexionAppliMobileJeton: this.mobile,
            uuidAppliMobile: this.mobile ? this.uuid : "",
            loginTokenSAV: "",
        };
        const idr = this.post("Identification", ident_json);
        console.log("indentification");

        console.log(idr);
        const challenge = idr.donneesSec.donnees.challenge;
        const e = new Encryption();
        e.aes_set_iv(this.communication.encryption.aes_iv);

        if (this.ent) {
            const motdepasse = sha256(this.password).toUpperCase();
            e.aes_set_key(motdepasse.toString());
        } else if (this.mobile) {
            let u = this.username;
            let p = this.password;
            if (idr.donneesSec.donnees.modeCompLog) {
                u = u.toLowerCase();
            }
            if (idr.donneesSec.donnees.modeCompMdp) {
                p = p.toLowerCase();
            }
            const motdepasse = sha256(p).toUpperCase();
            e.aes_set_key((u + motdepasse).toString());
        } else {
            let u = this.username;
            let p = this.password;
            if (idr.donneesSec.donnees.modeCompLog) {
                u = u.toLowerCase();
            }
            if (idr.donneesSec.donnees.modeCompMdp) {
                p = p.toLowerCase();
            }
            const alea = idr.donneesSec.donnees.alea;
            const motdepasse = sha256(alea + p).toUpperCase();
            e.aes_set_key((u + motdepasse).toString());
        }

        try {
            const dec = e.aes_decrypt(Buffer.from(challenge, "hex"));
            const dec_no_alea = _enleverAlea(dec.toString());
            const ch = e.aes_encrypt(dec_no_alea).toString("hex");
        } catch (ex) {
            if (this.mobile) {
                ex.message +=
                    "exception happened during login -> probably the qr code has expired (qr code is valid during 10 minutes)";
            } else {
                ex.message += "exception happened during login -> probably bad username/password";
            }
            throw ex;
        }

        const auth_json = {
            connexion: 0,
            challenge: ch,
            espace: parseInt(this.attributes.a),
        };
        const auth_response = this.post("Authentification", auth_json);
        if ("cle" in auth_response.donneesSec.donnees) {
            this.communication.after_auth(auth_response, e.aes_key);
            this.encryption.aes_key = e.aes_key;
            console.log(`successfully logged in as ${this.username}`);

            if (this.mobile && auth_response.donneesSec.donnees.jetonConnexionAppliMobile) {
                this.password = auth_response.donneesSec.donnees.jetonConnexionAppliMobile;
            }

            this.parametres_utilisateur = this.post("ParametresUtilisateur");
            this.info = new dataClasses.ClientInfo(
                this,
                this.parametres_utilisateur.donneesSec.donnees.ressource
            );
            this.communication.authorized_onglets = _prepare_onglets(
                this.parametres_utilisateur.donneesSec.donnees.listeOnglets
            );
            console.log("got onglets data.");
            return true;
        } else {
            console.log("login failed");
            return false;
        }
    }

    get_week(date) {
        if (date instanceof Date) {
            return 1 + Math.floor((date - this.start_day) / (7 * 24 * 60 * 60 * 1000));
        }
        return 1 + Math.floor((date - this.start_day) / (7 * 24 * 60 * 60 * 1000));
    }

    get periods() {
        if (this.periods_) {
            return this.periods_;
        }
        const json = this.func_options.donneesSec.donnees.General.ListePeriodes;
        return json.map(j => new Period(this, j));
    }

    keep_alive() {
        return new KeepAlive(this);
    }

    refresh() {
        console.log("Reinitialisation");
        this.communication.session.close();

        let cookies;
        if (this.ent) {
            cookies = this.ent(this.username, this.password);
        } else {
            cookies = null;
        }

        this.communication = new Communication(this.pronote_url, cookies, this);
        [this.attributes, this.func_options] = this.communication.initialise();

        this.encryption = new Encryption();
        this.encryption.aes_iv = this.communication.encryption.aes_iv;
        this._login();
        this.periods_ = null;
        this.periods_ = this.periods;
        this.week = this.get_week(new Date());
        this._expired = true;
    }

    session_check() {
        this.post("Presence", 7, {});
        if (this._expired) {
            this._expired = false;
            return true;
        }
        return false;
    }

    post(function_name, onglet = null, data = null) {
        const post_data = {};
        if (onglet) {
            post_data["_Signature_"] = { onglet: onglet };
        }
        if (data) {
            post_data["donnees"] = data;
        }

        try {
            return this.communication.post(function_name, post_data);
        } catch (e) {
            if (e instanceof ExpiredObject) {
                throw e;
            }

            console.log(
                `Have you tried turning it off and on again? ERROR: ${e.pronote_error_code} | ${e.pronote_error_msg}`
            );

            if (this._refreshing) {
                throw e;
            } else {
                this._refreshing = true;
                this.refresh();
                this._refreshing = false;
            }

            return this.communication.post(function_name, post_data);
        }
    }
}

class Client extends ClientBase {
    /**
     * A PRONOTE client.
     * 
     * @param {string} pronote_url - URL of the server
     * @param {string} username
     * @param {string} password
     * @param {function} ent - Cookies for ENT connections
     */
    constructor({pronote_url, username = "", password = "", ent = null, qr_code = false}) {
        console.log("INIT with : username = " + username + " password = " + password);
        super(pronote_url, username, password, ent, qr_code);
    }

    /**
     * Gets all lessons in a given timespan.
     * 
     * @param {Date|DateTime} date_from - first date
     * @param {Date|DateTime} date_to - second date, if null, then to the end of day_from
     * @returns {Array} - List of lessons
     */
    lessons(date_from, date_to = null) {
        const user = this.parametres_utilisateur["donneesSec"]["donnees"]["ressource"];
        const data = {
            "ressource": user,
            "avecAbsencesEleve": false,
            "avecConseilDeClasse": true,
            "estEDTPermanence": false,
            "avecAbsencesRessource": true,
            "avecDisponibilites": true,
            "avecInfosPrefsGrille": true,
            "Ressource": user
        };
        const output = [];

        // convert date to datetime
        if (date_from instanceof Date) {
            date_from = new Date(date_from.getFullYear(), date_from.getMonth(), date_from.getDate(), 0, 0, 0);
        }

        if (date_to instanceof Date) {
            date_to = new Date(date_to.getFullYear(), date_to.getMonth(), date_to.getDate(), 0, 0, 0);
        }

        if (!date_to) {
            date_to = new Date(date_from.getFullYear(), date_from.getMonth(), date_from.getDate(), 23, 59, 59);
        }

        const first_week = this.get_week(date_from);
        const last_week = this.get_week(date_to);

        // getting lessons for all the weeks.
        for (let week = first_week; week <= last_week; week++) {
            data["NumeroSemaine"] = data["numeroSemaine"] = week;
            const response = this.post("PageEmploiDuTemps", 16, data);
            const l_list = response["donneesSec"]["donnees"]["ListeCours"];
            for (const lesson of l_list) {
                output.push(new Lesson(this, lesson));
            }
        }

        // since we only have week precision, we need to make it more precise on our own
        return output.filter(lesson => date_from <= lesson.start && lesson.start <= date_to);
    }

    /**
     * Exports ICal URL for the client's timetable
     * 
     * @param {number} timezone_shift - in what timezone should the exported calendar be in (hour shift)
     * @returns {string} - URL for the exported ICal file
     */
    export_ical(timezone_shift = 0) {
        const user = this.parametres_utilisateur["donneesSec"]["donnees"]["ressource"];
        const data = {
            "ressource": user,
            "avecAbsencesEleve": false,
            "avecConseilDeClasse": true,
            "estEDTPermanence": false,
            "avecAbsencesRessource": true,
            "avecDisponibilites": true,
            "avecInfosPrefsGrille": true,
            "Ressource": user,
            "NumeroSemaine": 1,
            "numeroSemaine": 1
        };
        const response = this.post("PageEmploiDuTemps", 16, data);
        const icalsecurise = response["donneesSec"]["donnees"]["ParametreExportiCal"];
        if (!icalsecurise) {
            throw new ICalExportError("Pronote did not return ICal token");
        }

        const ver = this.func_options["donneesSec"]["donnees"]["General"]["versionPN"];
        const param = Buffer.from(`lh=${timezone_shift}`).toString("hex");

        return `${this.communication.root_site}/ical/Edt.ics?icalsecurise=${icalsecurise}&version=${ver}&param=${param}`;
    }

    /**
     * Get homework between two given points.
     * 
     * @param {Date} date_from - The first date
     * @param {Date} date_to - The second date. If unspecified to the end of the year.
     * @returns {Array} - Homework between two given points
     */
    homework(date_from, date_to = null) {
        if (!date_to) {
            date_to = new Date(this.func_options["donneesSec"]["donnees"]["General"]["DerniereDate"]["V"], "dd/MM/yyyy");
        }
        const json_data = {
            "domaine": {
                "_T": 8,
                "V": `[${this.get_week(date_from)}..${this.get_week(date_to)}]`
            }
        };

        const response = this.post("PageCahierDeTexte", 88, json_data);
        const h_list = response["donneesSec"]["donnees"]["ListeTravauxAFaire"]["V"];
        const out = [];
        for (const h of h_list) {
            const hw = new Homework(this, h);
            if (date_from <= hw.date && hw.date <= date_to) {
                out.push(hw);
            }
        }
        return out;
    }

    /**
     * Get recipients for new discussion
     * 
     * @returns {Array} - list of available recipients
     */
    getRecipients() {
        // Get recipients for new discussion
        // Returns a list of available recipients
        const data = { "onglet": { "N": 0, "G": 3 } };
        const recipients1 = this.post("ListeRessourcesPourCommunication", 131, data)["donneesSec"]["donnees"]["listeRessourcesPourCommunication"]["V"];
        
        data = { "onglet": { "N": 0, "G": 34 } };
        const recipients2 = this.post("ListeRessourcesPourCommunication", 131, data)["donneesSec"]["donnees"]["listeRessourcesPourCommunication"]["V"];

        const recipients = recipients1.concat(recipients2);
        
        return recipients.map((r) => new Recipient(this, r));
    }

    getTeachingStaff() {
        // Get the teacher list
        // Returns a list of teachers and other staff
        const teachers = this.post("PageEquipePedagogique", 37)["donneesSec"]["donnees"]["liste"]["V"];
        
        return teachers.map((t) => new TeachingStaff(t));
    }

    newDiscussion(subject, message, recipients) {
        // Create a new discussion
        const recipientsJson = recipients.map((r) => ({ "N": r.id, "G": r._type, "L": r.name }));
        const data = {
            "objet": subject,
            "contenu": message,
            "listeDestinataires": recipientsJson,
        };

        this.post("SaisieMessage", 131, data);
    }

    discussions(onlyUnread = false) {
        // Gets all the discussions in the discussions tab
        const discussions = this.post("ListeMessagerie", 131, { "avecMessage": true, "avecLu": !onlyUnread });
        
        const labels = discussions["donneesSec"]["donnees"]["listeEtiquettes"]["V"].reduce((acc, l) => {
            acc[l["N"]] = l["G"];
            return acc;
        }, {});

        return discussions["donneesSec"]["donnees"]["listeMessagerie"]["V"]
            .filter((d) => d["estUneDiscussion"] && (d["profondeur"] || 1) === 0)
            .map((d) => new Discussion(this, d, labels));
    }

    informationAndSurveys(dateFrom = null, dateTo = null, onlyUnread = false) {
        // Gets all the information and surveys in the information and surveys tab
        const response = this.post("PageActualites", 8, { "modesAffActus": { "_T": 26, "V": "[0..3]" } });
        const info = response["donneesSec"]["donnees"]["listeModesAff"].reduce((acc, liste) => {
            acc.push(...liste["listeActualites"]["V"].map((info) => new Information(this, info)));
            return acc;
        }, []);

        if (onlyUnread) {
            info = info.filter((i) => !i.read);
        }

        if (dateFrom !== null) {
            info = info.filter((i) => i.startDate !== null && dateFrom <= i.startDate);
        }

        if (dateTo !== null) {
            info = info.filter((i) => i.startDate !== null && i.startDate < dateTo);
        }

        return info;
    }

    menus(dateFrom, dateTo = null) {
        // Get menus between two given points
        const output = [];
        if (!dateTo) {
            dateTo = dateFrom;
        }

        let firstDay = new Date(dateFrom);
        firstDay.setDate(dateFrom.getDate() - dateFrom.getDay());

        while (firstDay <= dateTo) {
            const dateString = `${firstDay.getDate()}/${firstDay.getMonth() + 1}/${firstDay.getFullYear()} 0:0:0`;
            const data = { "date": { "_T": 7, "V": dateString } };
            const response = this.post("PageMenus", 10, data);
            const lList = response["donneesSec"]["donnees"]["ListeJours"]["V"];
            for (const day of lList) {
                for (const menu of day["ListeRepas"]["V"]) {
                    menu["Date"] = day["Date"];
                    output.push(new Menu(this, menu));
                }
            }
            firstDay.setDate(firstDay.getDate() + 7);
        }

        return output.filter((menu) => dateFrom <= menu.date && menu.date <= dateTo);
    }

    get currentPeriod() {
        // The current period
        const onglets = this.parametresUtilisateur["donneesSec"]["donnees"]["ressource"]["listeOngletsPourPeriodes"]["V"];
        
        const onglet = onglets.find((x) => x["G"] === 198) || onglets[0];
        const idPeriod = onglet["periodeParDefaut"]["V"]["N"];
        
        return dataClasses.Util.get(this.periods, { "id": idPeriod })[0];
    }
}

class ParentClient extends Client {
    /**
     * A parent PRONOTE client.
     * @param {string} pronoteUrl - URL of the server
     * @param {string} username
     * @param {string} password
     * @param {Function} ent - Cookies for ENT connections
     * @param {boolean} qrCode
     */
    constructor(pronoteUrl, username = "", password = "", ent = null, qrCode = false) {
        super(pronoteUrl, username, password, ent, qrCode);
        this.children = [];

        const ressources = this.parametresUtilisateur["donneesSec"]["donnees"]["ressource"]["listeRessources"];
        for (const c of ressources) {
            this.children.push(new dataClasses.ClientInfo(this, c));
        }

        if (!this.children.length) {
            throw new ChildNotFound("No children were found.");
        }

        this._selectedChild = this.children[0];
        this.parametresUtilisateur["donneesSec"]["donnees"]["ressource"] = this._selectedChild.rawResource;
    }

    /**
     * Select a child.
     * @param {string|dataClasses.ClientInfo} child - Name or ClientInfo of a child.
     */
    setChild(child) {
        let c;
        if (!(child instanceof dataClasses.ClientInfo)) {
            const candidates = dataClasses.Util.get(this.children, { "name": child });
            c = candidates[0] || null;
        } else {
            c = child;
        }

        if (!c) {
            throw new ChildNotFound(`A child with the name ${child} was not found.`);
        }

        this._selectedChild = c;
        this.parametresUtilisateur["donneesSec"]["donnees"]["ressource"] = this._selectedChild.rawResource;
    }

    /**
     * Performs a raw post to the PRONOTE server.
     * @param {string} function_name
     * @param {number} onglet
     * @param {Object} data
     * @returns {Object} Raw JSON
     */
    post(function_name, onglet = null, data = null) {
        const post_data = {};
        if (onglet) {
            post_data["_Signature_"] = {
                "onglet": onglet,
                "membre": { "N": this._selectedChild.id, "G": 4 },
            };
        }

        if (data) {
            post_data["donnees"] = data;
        }

        try {
            return this.communication.post(function_name, post_data);
        } catch (e) {
            if (e instanceof ExpiredObject) {
                throw e;
            }

            console.log(`Have you tried turning it off and on again? ERROR: ${e.pronoteErrorCode} | ${e.pronoteErrorMsg}`);
            this.refresh();
            return this.communication.post(function_name, post_data);
        }
    }
}


class VieScolaireClient extends ClientBase {
    /**
     * A PRONOTE client for Vie Scolaire accounts.
     * @param {string} pronoteUrl - URL of the server
     * @param {string} username
     * @param {string} password
     * @param {Function} ent - Cookies for ENT connections
     * @param {boolean} qrCode
     */
    constructor(pronoteUrl, username = "", password = "", ent = null, qrCode = false) {
        super(pronoteUrl, username, password, ent, qrCode);
        this.classes = this.parametresUtilisateur["donneesSec"]["donnees"]["listeClasses"]["V"].map((json) => new dataClasses.StudentClass(this, json));
    }
}


module.exports = {
    Client,
    ParentClient,
    VieScolaireClient,
}