const datetime = require("datetime");

const { Padding } = require("crypto");
const { ClientBase, Client } = require("./clients");
const {
  DataError,
  DiscussionClosed,
  ParsingError,
  DateParsingError,
  UnsupportedOperation,
} = require("./exceptions");

const chain = require("itertools").chain;

class Util {
  static grade_translate = [
    "Absent",
    "Dispense",
    "NonNote",
    "Inapte",
    "NonRendu",
    "AbsentZero",
    "NonRenduZero",
    "Felicitations",
  ];

  static get(iterable, kwargs) {
    const output = [];
    for (const i of iterable) {
      for (const attr in kwargs) {
        if (!i.hasOwnProperty(attr) || i[attr] !== kwargs[attr]) {
          break;
        }
      }
      output.push(i);
    }
    return output;
  }

  static grade_parse(string) {
    if (string.includes("|")) {
      return Util.grade_translate[parseInt(string[1]) - 1];
    } else {
      return string;
    }
  }

  static date_parse(formatted_date) {
    if (formatted_date.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      return datetime.strptime(formatted_date, "%d/%m/%Y").date();
    } else if (formatted_date.match(/^\d{2}\/\d{2}\/\d{2}$/)) {
      return datetime.strptime(formatted_date, "%d/%m/%y").date();
    } else if (
      formatted_date.match(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/)
    ) {
      return datetime.strptime(formatted_date, "%d/%m/%Y %H:%M:%S").date();
    } else if (formatted_date.match(/^\d{2}\/\d{2}\/\d{2} \d{2}h\d{2}$/)) {
      return datetime.strptime(formatted_date, "%d/%m/%y %Hh%M").date();
    } else if (formatted_date.match(/^\d{2}\/\d{2}$/)) {
      formatted_date += `/${new Date().getFullYear()}`;
      return datetime.strptime(formatted_date, "%d/%m/%Y").date();
    } else if (formatted_date.match(/^\d{4}$/)) {
      const date = new Date();
      const hours = parseInt(formatted_date.slice(0, 2));
      const minutes = parseInt(formatted_date.slice(2));
      formatted_date = `${date.getDate()}/${
        date.getMonth() + 1
      }/${date.getFullYear()} ${hours}h${minutes}`;
      return datetime.strptime(formatted_date, "%d/%m/%Y %Hh%M").date();
    } else {
      throw new DateParsingError("Could not parse date", formatted_date);
    }
  }

  static datetime_parse(formatted_date) {
    if (formatted_date.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      return datetime.strptime(formatted_date, "%d/%m/%Y");
    } else if (
      formatted_date.match(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/)
    ) {
      return datetime.strptime(formatted_date, "%d/%m/%Y %H:%M:%S");
    } else if (formatted_date.match(/^\d{2}\/\d{2}\/\d{2} \d{2}h\d{2}$/)) {
      return datetime.strptime(formatted_date, "%d/%m/%y %Hh%M");
    } else {
      throw new DateParsingError("Could not parse date", formatted_date);
    }
  }

  static html_parse(html_text) {
    return unescape(html_text.replace(/<.*?>/g, ""));
  }

  static place2time(listeHeures, place) {
    if (place > listeHeures.length) {
      place = place % (listeHeures.length - 1);
    }
    const start_time = listeHeures.find((x) => x.G === place);
    if (start_time === undefined) {
      throw new Error(`Could not find starting time for place ${place}`);
    }
    return datetime.strptime(start_time.L, "%Hh%M").time();
  }
}

class Object {
  /**
   * Base object for all pronotepy data classes.
   */
  constructor(jsonDict) {
    this._resolver = new Object._Resolver(jsonDict);
  }

  toDict(exclude = new Set(), includeProperties = false) {
    function serializeSlot(slot) {
      if (slot instanceof Object) {
        return slot.toDict();
      } else {
        // Assume all other values are primitives
        return slot;
      }
    }

    const serialized = {};

    // Join __slots__ with a list of all properties if includeProperties is true
    // otherwise just iterate overs __slots__
    const toIter = includeProperties
      ? [
          ...this.__slots__,
          ...Object.getOwnPropertyNames(this.constructor.prototype).filter(
            (prop) =>
              !prop.startsWith("_") &&
              typeof this.constructor.prototype[prop] === "function"
          ),
        ]
      : this.__slots__;

    for (const slotName of toIter) {
      if (slotName.startsWith("_") || exclude.has(slotName)) {
        // Skip private and excluded slots
        continue;
      }

      const slot = this[slotName];

      serialized[slotName] = Array.isArray(slot)
        ? slot.map((v) => serializeSlot(v))
        : serializeSlot(slot);
    }

    return serialized;
  }
}

class Subject extends Object {
  /**
   * Represents a subject. You shouldn't have to create this class manually.
   */
  constructor(parsedJson) {
    super(parsedJson);

    this.id = this._resolver(String, "N");
    this.name = this._resolver(String, "L");
    this.groups = this._resolver(Boolean, "estServiceGroupe", false);
  }
}

class Report extends Object {
  /**
   * Represents a student report. You shouldn't have to create this class manually.
   */
  constructor(parsedJson) {
    super(parsedJson);

    this.subjects = this._resolver(
      (list) => list.map((s) => new Report.ReportSubject(s)),
      "ListeServices",
      "V",
      []
    );

    this.comments = this._resolver(
      (list) => list.filter((c) => "L" in c).map((c) => c["L"]),
      "ObjetListeAppreciations",
      "V",
      "ListeAppreciations",
      "V",
      []
    );
  }
}

Report.ReportSubject = class ReportSubject extends Object {
  /**
   * Represents a subject found in a report. You shouldn't have to create this class manually.
   */
  constructor(parsedJson) {
    super(parsedJson);

    this.id = this._resolver(String, "N");
    this.name = this._resolver(String, "L");

    this.color = this._resolver(String, "couleur");
    this.comments = this._resolver(
      (list) => list.filter((c) => "L" in c).map((c) => c["L"]),
      "ListeAppreciations",
      "V"
    );

    const gradeOrNone = (grade) => (grade ? Util.gradeParse(grade) : null);

    this.classAverage = this._resolver(
      gradeOrNone,
      "MoyenneClasse",
      "V",
      false
    );
    this.studentAverage = this._resolver(
      gradeOrNone,
      "MoyenneEleve",
      "V",
      false
    );
    this.minAverage = this._resolver(gradeOrNone, "MoyenneInf", "V", false);
    this.maxAverage = this._resolver(gradeOrNone, "MoyenneSup", "V", false);
    this.coefficient = this._resolver(String, "Coefficient", "V", false);
    this.teachers = this._resolver(
      (list) => list.map((i) => i["L"]),
      "ListeProfesseurs",
      "V",
      []
    );
  }
};

class Absence extends Object {
  /**
   * Represents an absence with a given period. You shouldn't have to create this class manually.
   *
   * @param {object} json_dict - The JSON data for the absence.
   */
  constructor(json_dict) {
    this.id = this._resolver("N", "id");
    this.from_date = Util.datetime_parse("V", "from_date");
    this.to_date = Util.datetime_parse("V", "to_date");
    this.justified = this._resolver("justifie", false);
    this.hours = this._resolver("NbrHeures", undefined, false);
    this.days = this._resolver("NbrJours", 0);
    this.reasons = this._resolver("listeMotifs", "V", []);
  }
}

class Delay extends Object {
  /**
   * Represents a delay with a given period. You shouldn't have to create this class manually.
   *
   * @param {object} json_dict - The JSON data for the delay.
   */
  constructor(json_dict) {
    this.id = this._resolver("N", "id");
    this.date = Util.datetime_parse("V", "date");
    this.minutes = this._resolver("duree", 0);
    this.justified = this._resolver("justifie", false);
    this.justification = this._resolver("justification", undefined, false);
    this.reasons = this._resolver("listeMotifs", "V", []);
  }
}

class Period extends Object {
  /**
   * Represents a period of the school year. You shouldn't have to create this class manually.
   *
   * @param {ClientBase} client - The client object.
   * @param {object} json_dict - The JSON data for the period.
   */
  constructor(client, json_dict) {
    this.__class__.instances.add(this);
    this._client = client;

    this.id = this._resolver("N", "id");
    this.name = this._resolver("L", "name");
    this.start = Util.datetime_parse("V", "start");
    this.end = Util.datetime_parse("V", "end");
  }

  /**
   * Gets a report from a period.
   *
   * @returns {Report|null} - The report or null if not available.
   */
  get report() {
    const json_data = { periode: { G: 2, N: this.id, L: this.name } };
    const data = this._client.post("PageBulletins", 13, json_data)[
      "donneesSec"
    ]["donnees"];
    return "Message" in data ? null : new Report(data);
  }

  /**
   * Get grades from the period.
   *
   * @returns {Grade[]} - The list of grades.
   */
  get grades() {
    const json_data = { Periode: { N: this.id, L: this.name } };
    const response = this._client.post("DernieresNotes", 198, json_data);
    const grades = response["donneesSec"]["donnees"]["listeDevoirs"]["V"];
    return grades.map((g) => new Grade(g));
  }

  /**
   * Get averages from the period.
   *
   * @returns {Average[]} - The list of averages.
   */
  get averages() {
    const json_data = { Periode: { N: this.id, L: this.name } };
    const response = this._client.post("DernieresNotes", 198, json_data);
    const crs = response["donneesSec"]["donnees"]["listeServices"]["V"];
    try {
      return crs.map((c) => new Average(c));
    } catch (e) {
      if (e.path.join(".") === ["moyEleve", "V"].join(".")) {
        throw new UnsupportedOperation("Could not get averages");
      }

      throw e;
    }
  }

  /**
   * Get overall average from the period.
   *
   * @returns {string} - The overall average.
   */
  get overall_average() {
    const json_data = { Periode: { N: this.id, L: this.name } };
    const response = this._client.post("DernieresNotes", 198, json_data);
    const average = response["donneesSec"]["donnees"]["moyGenerale"];
    if (average) {
      return average["V"];
    } else {
      let a = 0;
      let total = 0;
      const services = response["donneesSec"]["donnees"]["listeServices"]["V"];
      services.forEach((s) => {
        const avrg = s["moyEleve"]["V"].replace(",", ".");
        const flt = parseFloat(avrg);
        if (!isNaN(flt)) {
          a += flt;
          total++;
        }
      });
      average = (total ? (a / total).toFixed(2) : -1).toString();
    }
    return average;
  }

  /**
   * Get group average from the period.
   *
   * @returns {string|null} - The group average or null if not available.
   */
  get class_overall_average() {
    const json_data = { Periode: { N: this.id, L: this.name } };
    const response = this._client.post("DernieresNotes", 198, json_data);
    const average = response["donneesSec"]["donnees"]["moyGeneraleClasse"];
    return average ? average["V"] : null;
  }

  /**
   * All evaluations from this period.
   *
   * @returns {Evaluation[]} - The list of evaluations.
   */
  get evaluations() {
    const json_data = { periode: { N: this.id, L: this.name, G: 2 } };
    const response = this._client.post("DernieresEvaluations", 201, json_data);
    const evaluations =
      response["donneesSec"]["donnees"]["listeEvaluations"]["V"];
    return evaluations.map((e) => new Evaluation(e));
  }

  /**
   * All absences from this period.
   *
   * @returns {Absence[]} - The list of absences.
   */
  get absences() {
    const json_data = {
      periode: { N: this.id, L: this.name, G: 2 },
      DateDebut: { _T: 7, V: this.start.format("DD/MM/YYYY HH:mm:ss") },
      DateFin: { _T: 7, V: this.end.format("DD/MM/YYYY HH:mm:ss") },
    };

    const response = this._client.post("PagePresence", 19, json_data);
    const absences = response["donneesSec"]["donnees"]["listeAbsences"]["V"];
    return absences.filter((a) => a["G"] === 13).map((a) => new Absence(a));
  }

  /**
   * All delays from this period.
   *
   * @returns {Delay[]} - The list of delays.
   */
  get delays() {
    const json_data = {
      periode: { N: this.id, L: this.name, G: 2 },
      DateDebut: { _T: 7, V: this.start.format("DD/MM/YYYY HH:mm:ss") },
      DateFin: { _T: 7, V: this.end.format("DD/MM/YYYY HH:mm:ss") },
    };

    const response = this._client.post("PagePresence", 19, json_data);
    const delays = response["donneesSec"]["donnees"]["listeAbsences"]["V"];
    return delays.filter((a) => a["G"] === 14).map((a) => new Delay(a));
  }

  /**
   * All punishments from a given period.
   *
   * @returns {Punishment[]} - The list of punishments.
   */
  get punishments() {
    const json_data = {
      periode: { N: this.id, L: this.name, G: 2 },
      DateDebut: { _T: 7, V: this.start.format("DD/MM/YYYY HH:mm:ss") },
      DateFin: { _T: 7, V: this.end.format("DD/MM/YYYY HH:mm:ss") },
    };

    const response = this._client.post("PagePresence", 19, json_data);
    const absences = response["donneesSec"]["donnees"]["listeAbsences"]["V"];
    return absences
      .filter((a) => a["G"] === 41)
      .map((a) => new Punishment(this._client, a));
  }
}

class Average extends Object {
  /**
   * Represents an Average.
   *
   * @param {Object} json_dict - The JSON dictionary containing average data.
   */
  constructor(json_dict) {
    this.student = this._resolver(Util.grade_parse, "moyEleve", "V");
    this.out_of = this._resolver(Util.grade_parse, "baremeMoyEleve", "V");
    this.default_out_of = this._resolver(
      Util.grade_parse,
      "baremeMoyEleveParDefault",
      "V",
      ""
    );
    this.class_average = this._resolver(Util.grade_parse, "moyClasse", "V");
    this.min = this._resolver(Util.grade_parse, "moyMin", "V");
    this.max = this._resolver(Util.grade_parse, "moyMax", "V");
    this.subject = new Subject(json_dict);
    this.background_color = this._resolver(str, "couleur", false);
  }
}

class Grade extends Object {
  /**
   * Represents a grade.
   *
   * @param {Object} json_dict - The JSON dictionary containing grade data.
   */
  constructor(json_dict) {
    this.id = this._resolver(str, "N");
    this.grade = this._resolver(Util.grade_parse, "note", "V");
    this.out_of = this._resolver(Util.grade_parse, "bareme", "V");
    this.default_out_of = this._resolver(
      Util.grade_parse,
      "baremeParDefaut",
      "V",
      false
    );
    this.date = this._resolver(Util.date_parse, "date", "V");
    this.subject = this._resolver(Subject, "service", "V");
    this.period = this._resolver(
      (p) => Util.get(Period.instances, (id = p))[0],
      "periode",
      "V",
      "N"
    );
    this.average = this._resolver(Util.grade_parse, "moyenne", "V", false);
    this.max = this._resolver(Util.grade_parse, "noteMax", "V");
    this.min = this._resolver(Util.grade_parse, "noteMin", "V");
    this.coefficient = this._resolver(str, "coefficient");
    this.comment = this._resolver(str, "commentaire");
    this.is_bonus = this._resolver(bool, "estBonus");
    this.is_optionnal = this._resolver(bool, "estFacultatif") && !this.is_bonus;
    this.is_out_of_20 = this._resolver(bool, "estRamenerSur20");
  }

  to_dict(exclude = new Set(), include_properties = false) {
    return super.to_dict(
      (exclude = new Set(["period"]).union(exclude)),
      include_properties
    );
  }
}

class Attachment extends Object {
  /**
   * Represents an attachment to homework, for example.
   *
   * @param {ClientBase} client - The client instance.
   * @param {Object} json_dict - The JSON dictionary containing attachment data.
   */
  constructor(client, json_dict) {
    this._client = client;
    this.name = this._resolver(str, "L", "");
    this.id = this._resolver(str, "N");
    this.type = this._resolver(int, "G");

    if (this.type === 0) {
      this.url = this.name;
    } else {
      const padd = Padding.pad(
        JSON.stringify({ N: this.id, Actif: true })
          .replace(/\s+/g, "")
          .encode(),
        16
      );
      const magic_stuff = client.communication.encryption
        .aes_encrypt(padd)
        .hex();

      this.url =
        `${client.communication.root_site}/FichiersExternes/${magic_stuff}/` +
        encodeURIComponent(this.name, "~()*!.'") +
        `?Session=${client.attributes["h"]}`;
    }

    this._data = null;
  }

  save(file_name = null) {
    if (this.type === 1) {
      const response = this._client.communication.session.get(this.url);
      if (!file_name) {
        file_name = this.name;
      }
      if (response.status_code !== 200) {
        throw new Error(
          "The file was not found on pronote. The URL may be badly formed."
        );
      }
      // Save the file to local storage
      // Implement this part according to your needs (e.g., using Node.js file system module)
    }
  }

  get data() {
    if (this._data) {
      return this._data;
    }
    const response = this._client.communication.session.get(this.url);
    return response.content;
  }
}

class LessonContent extends Object {
  /**
   * Represents the content of a lesson.
   *
   * @param {ClientBase} client - The client instance.
   * @param {Object} json_dict - The JSON dictionary containing lesson content data.
   */
  constructor(client, json_dict) {
    this._client = client;
    this.title = this._resolver(str, "L", false);
    this.description = this._resolver(
      Util.html_parse,
      "descriptif",
      "V",
      false
    );
    this.category = this._resolver(str, "categorie", "V", "L", false);
    this._files = this._resolver(tuple, "ListePieceJointe", "V");
  }

  get files() {
    return this._files.map((jsn) => new Attachment(this._client, jsn));
  }
}

class Lesson extends Object {
  /**
   * Represents a lesson with a given time.
   *
   * @param {ClientBase} client - The client instance.
   * @param {Object} json_dict - The JSON dictionary containing lesson data.
   */
  constructor(client, json_dict) {
    this._client = client;
    this._content = null;

    this.id = this._resolver(str, "N");
    this.canceled = this._resolver(bool, "estAnnule", false);
    this.status = this._resolver(str, "Statut", false);
    this.memo = this._resolver(str, "memo", false);
    this.background_color = this._resolver(str, "CouleurFond", false);
    this.outing = this._resolver(bool, "estSortiePedagogique", false);
    this.start = this._resolver(Util.datetime_parse, "DateDuCours", "V");
    this.exempted = this._resolver(bool, "dispenseEleve", false);
    this.virtual_classrooms = this._resolver(
      (l) => l.map((i) => i.url),
      "listeVisios",
      "V",
      []
    );
    this.num = this._resolver(int, "P", 0);
    this.detention = this._resolver(bool, "estRetenue", false);
    this.test = this._resolver(bool, "cahierDeTextes", "V", "estDevoir", false);

    this.end = this._resolver(
      Util.datetime_parse,
      "DateDuCoursFin",
      "V",
      false
    );
    if (this.end === null) {
      const end_times =
        client.func_options.donneesSec.donnees.General.ListeHeuresFin.V;

      const end_place =
        (json_dict.place % (end_times.length - 1)) + json_dict.duree - 1;

      const end_time = Util.place2time(end_times, end_place);
      this.end = this.start.set({
        hour: end_time.hour,
        minute: end_time.minute,
      });
    }

    this.teacher_names = [];
    this.classrooms = [];
    this.group_names = [];
    this.subject = null;

    if (!json_dict.ListeContenus) {
      throw new ParsingError(
        "Error while parsing for lesson details",
        json_dict,
        ["ListeContenus", "V"]
      );
    }

    json_dict.ListeContenus.V.forEach((d) => {
      if (!d.G) {
        return;
      } else if (d.G === 16) {
        this.subject = new Subject(d);
      } else if (d.G === 3) {
        this.teacher_names.push(d.L);
      } else if (d.G === 17) {
        this.classrooms.push(d.L);
      } else if (d.G === 2) {
        this.group_names.push(d.L);
      }
    });

    this.teacher_name = this.teacher_names.join(", ") || null;
    this.classroom = this.classrooms.join(", ") || null;
    this.group_name = this.group_names.join(", ") || null;
  }

  get normal() {
    if (this.detention === null && this.outing === null) {
      return true;
    }
    return false;
  }

  get content() {
    if (this._content) {
      return this._content;
    }
    const week = this._client.get_week(this.start.date());
    const data = {
      domaine: { _T: 8, V: `[${week}..${week}]` },
    };
    const response = this._client.post("PageCahierDeTexte", 89, data);
    let contents = {};
    response.donneesSec.donnees.ListeCahierDeTextes.V.forEach((lesson) => {
      if (lesson.cours.V.N === this.id && lesson.listeContenus.V.length > 0) {
        contents = lesson.listeContenus.V[0];
      }
    });
    if (!contents) {
      return null;
    }
    this._content = new LessonContent(this._client, contents);
    return this._content;
  }
}
class Homework {
  /**
   * Represents a homework. You shouldn't have to create this class manually.
   *
   * @param {ClientBase} client - The client instance
   * @param {object} json_dict - The JSON data for the homework
   */
  constructor(client, json_dict) {
    this._client = client;
    this.id = this._resolver(json_dict, "N");
    this.description = this._resolver(json_dict, "descriptif", "V");
    this.done = this._resolver(json_dict, "TAFFait");
    this.subject = this._resolver(json_dict, "Matiere", "V");
    this.date = this._resolver(json_dict, "PourLe", "V");
    this.background_color = this._resolver(json_dict, "CouleurFond");
    this._files = this._resolver(json_dict, "ListePieceJointe", "V");
  }

  /**
   * Sets the status of the homework.
   *
   * @param {boolean} status - The status to set
   */
  set_done(status) {
    const data = {
      listeTAF: [{ N: this.id, TAFFait: status }],
    };
    this._client.post("SaisieTAFFaitEleve", 88, data);
    this.done = status;
  }

  /**
   * Get all the files and links attached to the homework.
   *
   * @returns {Array} - An array of attachments
   */
  get files() {
    return this._files.map((jsn) => new Attachment(this._client, jsn));
  }
}

class Information {
  /**
   * Represents a information in an information and surveys tab.
   *
   * @param {ClientBase} client - The client instance
   * @param {object} json_dict - The JSON data for the information
   */
  constructor(client, json_dict) {
    this._client = client;
    this.id = this._resolver(json_dict, "N");
    this.title = this._resolver(json_dict, "L", false);
    this.author = this._resolver(json_dict, "auteur");
    this._raw_content = this._resolver(json_dict, "listeQuestions", "V");
    this.read = this._resolver(json_dict, "lue");
    this.creation_date = this._resolver(json_dict, "dateCreation", "V");
    this.start_date = this._resolver(json_dict, "dateDebut", "V", false);
    this.end_date = this._resolver(json_dict, "dateFin", "V", false);
    this.category = this._resolver(json_dict, "categorie", "V", "L");
    this.survey = this._resolver(json_dict, "estSondage");
    this.template = this._resolver(json_dict, "estModele", false);
    this.shared_template = this._resolver(json_dict, "estModelePartage", false);
    this.anonymous_response = this._resolver(json_dict, "reponseAnonyme");

    this.attachments = this._resolver(json_dict, "listeQuestions", "V").reduce(
      (attachments, question) => {
        question.listePiecesJointes.V.forEach((jsn) => {
          attachments.push(new Attachment(client, jsn));
        });
        return attachments;
      },
      []
    );
  }

  /**
   * Get the content of the information.
   *
   * @returns {string} - The content of the information
   */
  get content() {
    return Util.html_parse(this._raw_content[0].texte.V);
  }

  /**
   * Mark this information as read or unread.
   *
   * @param {boolean} status - `true` to mark as read, `false` to mark as unread
   */
  mark_as_read(status) {
    const data = {
      listeActualites: [
        {
          N: this.id,
          validationDirecte: true,
          genrePublic: 4,
          public: {
            N: this._client.info.id,
            G: 4,
          },
          lue: status,
        },
      ],
      saisieActualite: false,
    };
    this._client.post("SaisieActualites", 8, data);
    this.read = status;
  }
}
class ClientInfo {
    /**
     * Contains info for a resource (a client).
     * @param {ClientBase} client - The client object.
     * @param {Object} json_ - The JSON data representing the client info.
     */
    constructor(client, json_) {
        this.id = json_["N"];
        this.raw_resource = json_;
        this._client = client;
        this.__cache = null;
    }

    get name() {
        /**
         * Name of the client
         */
        return this.raw_resource["L"];
    }

    get profile_picture() {
        /**
         * Profile picture of the client
         */
        if (this.raw_resource["avecPhoto"]) {
            return new Attachment(
                this._client,
                {"L": "photo.jpg", "N": this.raw_resource["N"], "G": 1}
            );
        } else {
            return null;
        }
    }

    get delegue() {
        /**
         * List of classes of which the user is a delegue of
         */
        if (this.raw_resource["estDelegue"]) {
            return this.raw_resource["listeClassesDelegue"]["V"].map(
                (class_) => class_["L"]
            );
        } else {
            return [];
        }
    }

    get class_name() {
        /**
         * Name of the student's class
         */
        return this.raw_resource["classeDEleve"]["L"] || "";
    }

    get establishment() {
        /**
         * Name of the student's establishment
         */
        return this.raw_resource["Etablissement"]["V"]["L"] || "";
    }

    _cache() {
        if (this.__cache === null) {
            // This does not have all the protection _ClientBase.post provides,
            // but we need to manually add the resource id
            this.__cache = this._client.communication.post(
                "PageInfosPerso",
                {
                    "_Signature_": {
                        onglet: 49,
                        ressource: {N: this.id, G: 4}
                    }
                }
            )["donneesSec"]["donnees"]["Informations"];
        }
        return this.__cache;
    }

    get address() {
        /**
         * Address of the client
         * @returns {Array} - A tuple of 8 elements:
         *   - 4 lines of address info
         *   - postal code
         *   - city
         *   - province
         *   - country
         */
        const c = this._cache();
        return [
            c["adresse1"],
            c["adresse2"],
            c["adresse3"],
            c["adresse4"],
            c["codePostal"],
            c["ville"],
            c["province"],
            c["pays"]
        ];
    }

    get email() {
        /**
         * Email of the client
         */
        return this._cache()["eMail"];
    }

    get phone() {
        /**
         * Phone of the client
         * @returns {string} - Phone in the format +[country-code][phone-number]
         */
        const c = this._cache();
        return "+" + c["indicatifTel"] + c["telephonePortable"];
    }

    get ine_number() {
        /**
         * INE number of the client
         */
        return this._cache()["numeroINE"];
    }
}


class StudentClass {
  /**
   * Represents a class of students
   *
   * @param {ClientBase} client
   * @param {object} json_dict
   */
  constructor(client, json_dict) {
    this.name = this._resolver((json_dict) => json_dict["L"], "L");
    this.id = this._resolver((json_dict) => json_dict["N"], "N");
    this.responsible = this._resolver(
      (json_dict) => json_dict["estResponsable"],
      "estResponsable"
    );
    this.grade = this._resolver(
      (json_dict) => json_dict["niveau"]["V"]["L"],
      "niveau",
      "V",
      "L",
      ""
    );

    this._client = client;

    this._resolver = undefined;
  }

  /**
   * Get students in the class
   *
   * @param {Period} period - select a particular period (client.periods[0] by default)
   * @returns {Array<Student>}
   */
  students(period = null) {
    period = period || this._client.periods[0];
    const r = this._client.post("ListeRessources", 105, {
      classe: { N: this.id, G: 1 },
      periode: { N: period.id, G: 1 },
    });
    return r["donneesSec"]["donnees"]["listeRessources"]["V"].map(
      (j) => new Student(this._client, j)
    );
  }
}

class Menu {
  /**
   * Represents the menu of a meal
   *
   * @param {ClientBase} client
   * @param {object} json_dict
   */
  constructor(client, json_dict) {
    this.id = this._resolver((json_dict) => json_dict["N"], "N");
    this.name = this._resolver((json_dict) => json_dict["L"], "L", false);
    this.date = Util.date_parse(json_dict["Date"]["V"]);
    this.is_lunch = this._resolver((json_dict) => json_dict["G"] === 0, "G");
    this.is_dinner = this._resolver((json_dict) => json_dict["G"] === 1, "G");

    const init_food = (d) =>
      d["ListeAliments"]["V"].map((x) => new Menu.Food(client, x));
    const d_dict = json_dict["ListePlats"]["V"].reduce(
      (acc, meal) => ({ ...acc, [meal["G"]]: meal }),
      {}
    );

    this.first_meal = this._resolver(init_food, "0", false);
    this.main_meal = this._resolver(init_food, "1", false);
    this.side_meal = this._resolver(init_food, "2", false);
    this.other_meal = this._resolver(init_food, "3", false);
    this.cheese = this._resolver(init_food, "5", false);
    this.dessert = this._resolver(init_food, "4", false);

    this._client = client;

    this._resolver = undefined;
  }
}
class Food {
  /**
   * Represents food of a menu
   *
   * @param {ClientBase} client
   * @param {object} json_dict
   */
  constructor(client, json_dict) {
    this.id = this._resolver((json_dict) => json_dict["N"], "N");
    this.name = this._resolver((json_dict) => json_dict["L"], "L");
    this.labels = this._resolver(
      (json_dict) =>
        json_dict["listeLabelsAlimentaires"]["V"].map(
          (label) => new Menu.Food.FoodLabel(client, label)
        ),
      "listeLabelsAlimentaires",
      "V"
    );

    this._client = client;

    this._resolver = undefined;
  }
}

class FoodLabel {
  /**
   * Represents the label of a food
   *
   * @param {ClientBase} client
   * @param {object} json_dict
   */
  constructor(client, json_dict) {
    this.id = this._resolver((json_dict) => json_dict["N"], "N");
    this.name = this._resolver((json_dict) => json_dict["L"], "L");
    this.color = this._resolver(
      (json_dict) => json_dict["couleur"],
      "couleur",
      false
    );

    this._client = client;

    this._resolver = undefined;
  }
}

class Punishment {
  /**
   * Represents a punishment.
   *
   * @param {ClientBase} client
   * @param {object} json_dict
   */
  constructor(client, json_dict) {
    this.id = this._resolver((json_dict) => json_dict["N"], "N");
    this.given = Util.date_parse(json_dict["dateDemande"]["V"]);
    this.during_lesson = this._resolver(
      (json_dict) => !json_dict["horsCours"],
      "horsCours"
    );
    this.exclusion = this._resolver(
      (json_dict) => json_dict["estUneExclusion"],
      "estUneExclusion"
    );
    this.homework = this._resolver(
      (json_dict) => json_dict["travailAFaire"],
      "travailAFaire"
    );
    this.homework_documents = this._resolver(
      (json_dict) =>
        json_dict["documentsTAF"]["V"].map((a) => new Attachment(client, a)),
      "documentsTAF",
      "V"
    );
    this.circumstances = this._resolver(
      (json_dict) => json_dict["circonstances"],
      "circonstances"
    );
    this.circumstance_documents = this._resolver(
      (json_dict) =>
        json_dict["documentsCirconstances"]["V"].map(
          (a) => new Attachment(client, a)
        ),
      "documentsCirconstances",
      "V"
    );
    this.nature = this._resolver(
      (json_dict) => json_dict["nature"]["V"]["L"],
      "nature",
      "V",
      "L"
    );
    this.requires_parent = this._resolver(
      (json_dict) => json_dict["nature"]["V"]["estAvecARParent"],
      "nature",
      "V",
      "estAvecARParent",
      false
    );
    this.reasons = this._resolver(
      (json_dict) => json_dict["listeMotifs"]["V"].map((i) => i["L"]),
      "listeMotifs",
      "V"
    );
    this.giver = this._resolver(
      (json_dict) => json_dict["demandeur"]["V"]["L"],
      "demandeur",
      "V",
      "L"
    );
    this.schedulable = this._resolver(
      (json_dict) => json_dict["estProgrammable"],
      "estProgrammable"
    );
    this.schedule = this.schedulable
      ? this._resolver(
          (json_dict) =>
            json_dict["programmation"]["V"].map(
              (i) => new Punishment.ScheduledPunishment(client, i)
            ),
          "programmation",
          "V"
        )
      : [];
    this.duration = this._resolver(
      (json_dict) => json_dict["duree"],
      "duree",
      false
    );
    this._resolver = undefined;
  }
}

class ScheduledPunishment {
  /**
   * Represents a scheduled punishment.
   *
   * @param {ClientBase} client
   * @param {object} json_dict
   */
  constructor(client, json_dict) {
    this.id = this._resolver((json_dict) => json_dict["N"], "N");
    const date = Util.date_parse(json_dict["date"]["V"]);
    const place = this._resolver(
      (json_dict) => json_dict["placeExecution"],
      "placeExecution",
      false
    );
    this.start = place
      ? new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          Util.place2time(
            client.func_options["donneesSec"]["donnees"]["General"][
              "ListeHeures"
            ]["V"],
            place
          ).getHours(),
          Util.place2time(
            client.func_options["donneesSec"]["donnees"]["General"][
              "ListeHeures"
            ]["V"],
            place
          ).getMinutes()
        )
      : date;
    this.duration = this._resolver(
      (json_dict) =>
        new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          0,
          json_dict["duree"] * 60
        ),
      "duree",
      false
    );
    this._resolver = undefined;
  }
}

class TeachingStaff {
  /**
   * Represents a teaching staff member.
   * @param {Object} jsonDict - The JSON data representing the teaching staff.
   */
  constructor(jsonDict) {
    this.id = jsonDict.N || "";
    this.name = jsonDict.L || "";
    this.num = parseInt(jsonDict.P) || 0;
    this._type = parseInt(jsonDict.G) || 0;
    this.type = this._type === 3 ? "teacher" : "staff";
    this.subjects = this._parseSubjects(jsonDict.matieres.V || []);
  }

  _parseSubjects(subjectsData) {
    return subjectsData.map((subjectData) => new TeachingSubject(subjectData));
  }
}

class TeachingSubject {
  /**
   * Represents a subject taught.
   * @param {Object} jsonDict - The JSON data representing the teaching subject.
   */
  constructor(jsonDict) {
    this.id = jsonDict.N || "";
    this.name = jsonDict.L || "";
    this._duration = jsonDict.volumeHoraire || "";
    this.parent_subject_name =
      (jsonDict.servicePere && jsonDict.servicePere.L) || null;
    this.parent_subject_id =
      (jsonDict.servicePere && jsonDict.servicePere.N) || null;

    if (this._duration.includes("h")) {
      const [hours, minutes] = this._duration
        .split("h")
        .map((value) => parseInt(value));
      this.duration = {
        hours,
        minutes,
      };
    } else {
      this.duration = null;
    }
  }
}

module.exports = {
  ClientInfo,
  StudentClass,
  Menu,
  Punishment,
  ScheduledPunishment,
  TeachingStaff,
  TeachingSubject,
  Period,
  Lesson,
  LessonContent,
  Attachment,
  Grade,
  Average,
  Absence,
  Delay,
  Punishment,
  Information,
  Homework,
  Util,
};
