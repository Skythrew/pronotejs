const { getLogger, DEBUG } = require('logging');
const typing = require('typing');

const requests = require('requests');
const { BeautifulSoup } = require('beautifulsoup');
const { urlparse, parse_qs } = require('url');

const { ENTLoginError } = require('../exceptions');
const { _educonnect } = require('./generic_func.js');

const log = getLogger(__name__);
log.setLevel(DEBUG);

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:73.0) Gecko/20100101 Firefox/73.0"
};

function ac_rennes(username, password) {
    /**
     * ENT ac Rennes Toutatice.fr
     *
     * @param {string} username - username
     * @param {string} password - password
     * @returns {requests.cookies.RequestsCookieJar} - returns the ent session cookies
     */

    // Toutatice required URL
    const toutatice_url = "https://www.toutatice.fr/portail/auth/MonEspace";
    const toutatice_login = "https://www.toutatice.fr/wayf/Ctrl";
    const toutatice_auth = "https://www.toutatice.fr/idp/Authn/RemoteUser";

    const session = new requests.Session();

    let response = session.get(toutatice_url, { headers: HEADERS });
    let soup = new BeautifulSoup(response.text, "html.parser");
    let payload = {
        "entityID": soup.find("input", { "name": "entityID" })["value"],
        "return": soup.find("input", { "name": "return" })["value"],
        "_saml_idp": soup.find("input", { "name": "_saml_idp" })["value"],
    };

    log.debug(`[ENT Toutatice] Logging in with ${username}`);
    response = session.post(toutatice_login, { data: payload, headers: HEADERS });

    _educonnect(session, username, password, response.url);

    const params = {
        "conversation": parse_qs(urlparse(response.url).query)["execution"][0],
        "redirectToLoaderRemoteUser": 0,
        "sessionid": session.cookies.get("IDP_JSESSIONID"),
    };

    response = session.get(toutatice_auth, { headers: HEADERS, params });
    soup = new BeautifulSoup(response.text, "xml");

    if (soup.find("erreurFonctionnelle")) {
        throw new ENTLoginError("Toutatice ENT (ac_rennes) : " + soup.find("erreurFonctionnelle").text);
    } else if (soup.find("erreurTechnique")) {
        throw new ENTLoginError("Toutatice ENT (ac_rennes) : " + soup.find("erreurTechnique").text);
    } else {
        params = {
            "conversation": soup.find("conversation").text,
            "uidInSession": soup.find("uidInSession").text,
            "sessionid": session.cookies.get("IDP_JSESSIONID"),
        };
        t = session.get(toutatice_auth, { headers: HEADERS, params });
    }

    return session.cookies;
}

function pronote_hubeduconnect(pronote_url) {
    /**
     * Pronote EduConnect connection (with HubEduConnect.index-education.net)
     *
     * @param {string} pronote_url - the same pronote_url as passed to the client
     * @returns {Function} - inner function for connecting
     */

    // URLs required for the connection
    const hubeduconnect_base = "https://hubeduconnect.index-education.net/EduConnect/cas/login";

    function inner(username, password) {
        const session = new requests.Session();

        let response = session.get(`${hubeduconnect_base}?service=${pronote_url}`, { headers: HEADERS });

        let soup = new BeautifulSoup(response.text, "html.parser");
        let input_SAMLRequest = soup.find("input", { "name": "SAMLRequest" });
        if (input_SAMLRequest) {
            let payload = {
                "SAMLRequest": input_SAMLRequest["value"],
            };

            let input_relayState = soup.find("input", { "name": "RelayState" });
            if (input_relayState) {
                payload["RelayState"] = input_relayState["value"];
            }

            response = session.post(soup.find("form")["action"], { data: payload, headers: HEADERS });
        }

        if (response.content.includes('<label id="zone_msgDetail">L&#x27;url de service est vide</label>')) {
            throw new ENTLoginError("Fail to connect with HubEduConnect : Service URL not provided.");
        } else if (response.content.includes("n&#x27;est pas une url de confiance.")) {
            throw new ENTLoginError("Fail to connect with HubEduConnect : Service URL not trusted. Is Pronote instance supported?");
        }

        _educonnect(session, username, password, response.url);

        return session.cookies;
    }

    return inner;
}
