// Import des modules nécessaires
const { partial } = require('lodash');

// Import des fonctions depuis le module generic_func.js
const {
    _cas,
    _cas_edu,
    _open_ent_ng_edu,
    _open_ent_ng,
    _wayf,
    _oze_ent,
    _simple_auth,
} = require('./generic_func.js');

// CAS
const ac_clermont_ferrand = partial(_cas, {
    url: 'https://cas.ent.auvergnerhonealpes.fr/login?selection=CLERMONT-ATS_parent_eleve',
});

const ac_grenoble = partial(_cas, {
    url: 'https://cas.ent.auvergnerhonealpes.fr/login?selection=GRE-ATS_parent_eleve',
});

const ac_lyon = partial(_cas, {
    url: 'https://cas.ent.auvergnerhonealpes.fr/login?selection=LYON-ATS_parent_eleve',
});

const cas_arsene76 = partial(_cas, {
    url: 'https://cas.arsene76.fr/login?selection=ATS_parent_eleve',
});

const cas_cybercolleges42 = partial(_cas, {
    url: 'https://cas.cybercolleges42.fr/login?selection=ATS_parent_eleve',
});

const cas_ent27 = partial(_cas, {
    url: 'https://cas.ent27.fr/login?selection=ATS_parent_eleve',
});

const cas_kosmos = partial(_cas, {
    url: 'https://cas.kosmoseducation.com/login',
});

const ecollege_haute_garonne = partial(_cas, {
    url: 'https://cas.ecollege.haute-garonne.fr/login?selection=ATS_parent_eleve',
});

const ent_creuse = partial(_cas, {
    url: 'https://cas.entcreuse.fr/login',
});

const occitanie_toulouse = partial(_cas, {
    url: 'https://cas.mon-ent-occitanie.fr/login?selection=TOULO-ENT_parent_eleve',
});

const occitanie_montpellier = partial(_cas, {
    url: 'https://cas.mon-ent-occitanie.fr/login?selection=CSES-ENT_parent_eleve',
});

const val_doise = partial(_cas, {
    url: 'https://cas.moncollege.valdoise.fr/login?selection=eleveparent',
});

// CAS avec EduConnect
const cas_cybercolleges42_edu = partial(_cas_edu, {
    url: 'https://cas.cybercolleges42.fr/login?selection=EDU_parent_eleve&service=https://example.com/',
});

const ecollege_haute_garonne_edu = partial(_cas_edu, {
    url: 'https://cas.ecollege.haute-garonne.fr/login?selection=EDU_parent_eleve&service=https://example.com/',
});

const ac_orleans_tours = partial(_cas_edu, {
    url: 'https://ent.netocentre.fr/cas/login?&idpId=parentEleveEN-IdP',
    redirect_form: false,
});

const ac_poitiers = partial(_cas_edu, {
    url: 'https://sp-ts.ac-poitiers.fr/dispatcher/index2.php',
    redirect_form: false,
});

const ac_reunion = partial(_cas_edu, {
    url: 'https://sso.ac-reunion.fr/saml/discovery/?idp_ident=https://educonnect.education.gouv.fr/idp',
});

const cas_agora06 = partial(_cas_edu, {
    url: 'https://cas.agora06.fr/login?selection=EDU&service=https://example.com/',
});

const cas_seinesaintdenis_edu = partial(_cas_edu, {
    url: 'https://cas.webcollege.seinesaintdenis.fr/login?selection=EDU_parent_eleve&service=https://example.com/',
});

const cas_arsene76_edu = partial(_cas_edu, {
    url: 'https://cas.arsene76.fr/login?selection=EDU_parent_eleve&service=https://example.com/',
});

const eclat_bfc = partial(_cas_edu, {
    url: 'https://cas.eclat-bfc.fr/login?selection=EDU&service=https://example.com/',
});

const ent_auvergnerhonealpe = partial(_cas_edu, {
    url: 'https://cas.ent.auvergnerhonealpes.fr/login?selection=EDU&service=https://example.com/',
});

const laclasse_educonnect = partial(_cas_edu, {
    url: 'https://www.laclasse.com/sso/educonnect',
    redirect_form: false,
});

const monbureaunumerique = partial(_cas_edu, {
    url: 'https://cas.monbureaunumerique.fr/login?selection=EDU&service=https://example.com/',
});

const ac_reims = monbureaunumerique;

const occitanie_montpellier_educonnect = partial(_cas_edu, {
    url: 'https://cas.mon-ent-occitanie.fr/login?selection=MONT-EDU_parent_eleve&service=https://example.com/',
});

const occitanie_toulouse_edu = partial(_cas_edu, {
    url: 'https://cas.mon-ent-occitanie.fr/login?selection=TOULO-EDU_parent_eleve&service=https://example.com/',
});

// Open ENT NG
const ent77 = partial(_open_ent_ng, {
    url: 'https://ent77.seine-et-marne.fr/auth/login',
});

const ent_essonne = partial(_open_ent_ng, {
    url: 'https://www.moncollege-ent.essonne.fr/auth/login',
});

const ent_mayotte = partial(_open_ent_ng, {
    url: 'https://mayotte.opendigitaleducation.com/auth/login',
});

const ile_de_france = partial(_open_ent_ng, {
    url: 'https://ent.iledefrance.fr/auth/login',
});

const neoconnect_guadeloupe = partial(_open_ent_ng, {
    url: 'https://neoconnect.opendigitaleducation.com/auth/login',
});

const paris_classe_numerique = partial(_open_ent_ng, {
    url: 'https://ent.parisclassenumerique.fr/auth/login',
});

const lyceeconnecte_aquitaine = partial(_open_ent_ng, {
    url: 'https://mon.lyceeconnecte.fr/auth/login',
});

// Open ENT NG avec EduConnect
const ent_94 = partial(_open_ent_ng_edu, {
    domain: 'https://ent94.opendigitaleducation.com',
    providerId: 'urn:fi:ent:prod-cd94-edu:1.0',
});

const ent_hdf = partial(_open_ent_ng_edu, {
    domain: 'https://enthdf.fr',
});

const ent_somme = ent_hdf;

const ent_var = partial(_open_ent_ng_edu, {
    domain: 'https://moncollege-ent.var.fr',
    providerId: 'urn:fi:ent:prod-cd83-edu:1.0',
});

const l_normandie = partial(_open_ent_ng_edu, {
    domain: 'https://ent.l-educdenormandie.fr',
});

const lyceeconnecte_edu = partial(_open_ent_ng_edu, {
    domain: 'https://mon.lyceeconnecte.fr',
});

// WAYF
const ent_elyco = partial(_wayf, {
    domain: 'https://cas3.e-lyco.fr',
    redirect_form: false,
});

const ent2d_bordeaux = partial(_wayf, {
    domain: 'https://ds.ac-bordeaux.fr',
    entityID: 'https://ent2d.ac-bordeaux.fr/shibboleth',
    returnX: 'https://ent2d.ac-bordeaux.fr/Shibboleth.sso/Login?SAMLDS=1&target=https%3A%2F%2Fent2d.ac-bordeaux.fr%2Fargos%2Fpr%2Findex%2Findex',
});

// OZE ENT
const enc_hauts_de_seine = partial(_oze_ent, {
    url: 'https://enc.hauts-de-seine.fr/',
});

const ozecollege_yvelines = partial(_oze_ent, {
    url: 'https://ozecollege.yvelines.fr/',
});

// Authentification simple
const atrium_sud = partial(_simple_auth, {
    url: 'https://www.atrium-sud.fr/connexion/login',
    form_attr: { id: 'fm1' },
});

const laclasse_lyon = partial(_simple_auth, {
    url: 'https://www.laclasse.com/sso/login',
});

const extranet_colleges_somme = partial(_simple_auth, {
    url: 'http://www.colleges.cg80.fr/identification/identification.php',
});


// Module d'export
module.exports = {
    // CAS
    ac_clermont_ferrand,
    ac_grenoble,
    ac_lyon,
    cas_arsene76,
    cas_cybercolleges42,
    cas_ent27,
    cas_kosmos,
    ecollege_haute_garonne,
    ent_creuse,
    occitanie_toulouse,
    occitanie_montpellier,
    val_doise,
    // CAS avec EduConnect
    cas_cybercolleges42_edu,
    ecollege_haute_garonne_edu,
    ac_orleans_tours,
    ac_poitiers,
    ac_reunion,
    cas_agora06,
    cas_seinesaintdenis_edu,
    cas_arsene76_edu,
    eclat_bfc,
    ent_auvergnerhonealpe,
    laclasse_educonnect,
    monbureaunumerique,
    ac_reims,
    occitanie_montpellier_educonnect,
    occitanie_toulouse_edu,
    // Open ENT NG
    ent77,
    ent_essonne,
    ent_mayotte,
    ile_de_france,
    neoconnect_guadeloupe,
    paris_classe_numerique,
    lyceeconnecte_aquitaine,
    // Open ENT NG avec EduConnect
    ent_94,
    ent_hdf,
    ent_somme,
    ent_var,
    l_normandie,
    lyceeconnecte_edu,
    // WAYF
    ent_elyco,
    ent2d_bordeaux,
    // OZE ENT
    enc_hauts_de_seine,
    ozecollege_yvelines,
    // Authentification simple
    atrium_sud,
    laclasse_lyon,
    extranet_colleges_somme,
  };
  