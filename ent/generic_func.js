const request = require('request-promise');
const cheerio = require('cheerio');
const { urljoin, urlparse, urlunparse } = require('url');

log = {
    debug: console.log,
};

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:73.0) Gecko/20100101 Firefox/73.0"
};

async function _educonnect(session, username, password, url, exceptions = true) {
    if (!url) {
        throw new Error("Missing url attribute");
    }

    log.debug(`[EduConnect ${url}] Logging in with ${username}`);

    const payload = {
        j_username: username,
        j_password: password,
        _eventId_proceed: "",
    };

    const response = await session.post({
        url,
        headers: HEADERS,
        form: payload,
    });

    // 2nd SAML Authentication
    const $ = cheerio.load(response);
    const input_SAMLResponse = $('input[name="SAMLResponse"]');
    
    if (!input_SAMLResponse.length && response.statusCode === 200 && url !== response.url) {
        // manual redirect
        const secondResponse = await session.post({
            url: response.url,
            headers: HEADERS,
            form: payload,
        });
        const $second = cheerio.load(secondResponse);
        const input_SAMLResponseSecond = $second('input[name="SAMLResponse"]');
        if (!input_SAMLResponseSecond.length) {
            if (exceptions) {
                throw new Error("Fail to connect with EduConnect: probably wrong login information");
            } else {
                return null;
            }
        }
    }

    const input_relayState = $('input[name="RelayState"]');
    const payload2 = {
        SAMLResponse: input_SAMLResponse.val(),
    };

    if (input_relayState.length) {
        payload2.RelayState = input_relayState.val();
    }

    const finalResponse = await session.post({
        url: $('form').attr('action'),
        headers: HEADERS,
        form: payload2,
    });

    return finalResponse;
}

async function _cas_edu(username, password, url = "", redirect_form = true) {
    if (!url) {
        throw new Error("Missing url attribute");
    }

    log.debug(`[ENT ${url}] Logging in with ${username}`);

    const session = request.defaults({ jar: true });
    const response = await session.get({ url, headers: HEADERS });

    if (redirect_form) {
        const $ = cheerio.load(response);
        const input_SAMLRequest = $('input[name="SAMLRequest"]');
        if (input_SAMLRequest.length) {
            const payload = {
                SAMLRequest: input_SAMLRequest.val(),
            };
    
            const input_relayState = $('input[name="RelayState"]');
            if (input_relayState.length) {
                payload.RelayState = input_relayState.val();
            }
    
            const secondResponse = await session.post({
                url: $('form').attr('action'),
                form: payload,
                headers: HEADERS,
            });
            const $second = cheerio.load(secondResponse);
            const input_SAMLResponseSecond = $second('input[name="SAMLResponse"]');
            if (!input_SAMLResponseSecond.length) {
                throw new Error(`Fail to connect with CAS ${url}: probably wrong login information`);
            }
        }
    }

    await _educonnect(session, username, password, response.url, false);

    return session.cookie();
}

async function _cas(username, password, url = "") {
    if (!url) {
        throw new Error("Missing url attribute");
    }

    log.debug(`[ENT ${url}] Logging in with ${username}`);

    const session = request.defaults({ jar: true });
    const response = await session.get({ url, headers: HEADERS });

    const $ = cheerio.load(response);
    const form = $('form.cas__login-form');
    const payload = {};

    form.find('input').each((_, input) => {
        const $input = $(input);
        payload[$input.attr('name')] = $input.attr('value');
    });

    payload.username = username;
    payload.password = password;

    const r = await session.post({
        url: response.url,
        form: payload,
        headers: HEADERS,
    });

    const $r = cheerio.load(r);
    if ($r('form.cas__login-form').length) {
        throw new Error(`Fail to connect with CAS ${url}: probably wrong login information`);
    }

    return session.cookie();
}

async function _open_ent_ng(username, password, url = "") {
    if (!url) {
        throw new Error("Missing url attribute");
    }

    log.debug(`[ENT ${url}] Logging in with ${username}`);

    const session = request.defaults({ jar: true });
    const payload = {
        email: username,
        password: password,
    };

    const r = await session.post({
        url,
        headers: HEADERS,
        form: payload,
    });

    if (r.url.includes("login")) {
        throw new Error(`Fail to connect with Open NG ${url}: probably wrong login information`);
    }

    return session.cookie();
}

async function _open_ent_ng_edu(username, password, domain = "", providerId = "") {
    if (!domain) {
        throw new Error("Missing domain attribute");
    }
    if (!providerId) {
        providerId = `${domain}/auth/saml/metadata/idp.xml`;
    }

    log.debug(`[ENT ${domain}] Logging in with ${username}`);

    const ent_login_page = "https://educonnect.education.gouv.fr/idp/profile/SAML2/Unsolicited/SSO";
    const session = request.defaults({ jar: true });
    const params = {
        providerId: providerId,
    };

    const response = await session.get({
        url: ent_login_page,
        qs: params,
        headers: HEADERS,
    });

    const finalResponse = await _educonnect(session, username, password, response.url, false);

    if (!finalResponse) {
        log.debug("Fail to connect with EduConnect, trying with Open NG");
        return _open_ent_ng(username, password, `${domain}/auth/login`);
    } else if (finalResponse.url.includes("login")) {
        log.debug("Fail to connect with EduConnect, trying with Open NG");
        return _open_ent_ng(username, password, finalResponse.url);
    }

    return session.cookie();
}

async function _wayf(username, password, domain = "", entityID = "", returnX = "", redirect_form = true) {
    if (!domain) {
        throw new Error("Missing domain attribute");
    }
    if (!entityID) {
        entityID = `${domain}/shibboleth`;
    }
    if (!returnX) {
        returnX = `${domain}/Shibboleth.sso/Login`;
    }

    log.debug(`[ENT ${domain}] Logging in with ${username}`);

    const ent_login_page = `${domain}/discovery/WAYF`;
    const session = request.defaults({ jar: true });
    const params = {
        entityID: entityID,
        returnX: returnX,
        returnIDParam: "entityID",
        action: "selection",
        origin: "https://educonnect.education.gouv.fr/idp",
    };

    const response = await session.get({
        url: ent_login_page,
        qs: params,
        headers: HEADERS,
    });

    if (redirect_form) {
        const $ = cheerio.load(response);
        const payload = {
            RelayState: $('input[name="RelayState"]').val(),
            SAMLRequest: $('input[name="SAMLRequest"]').val(),
        };

        const secondResponse = await session.post({
            url: $('form').attr('action'),
            form: payload,
            headers: HEADERS,
        });

        await _educonnect(session, username, password, secondResponse.url);
    } else {
        await _educonnect(session, username, password, response.url);
    }

    return session.cookie();
}

async function _oze_ent(username, password, url = "") {
    if (!url) {
        throw new Error("Missing url attribute");
    }

    log.debug(`[ENT ${url}] Logging in with ${username}`);

    const session = request.defaults({ jar: true });
    const response = await session.get({
        url,
        headers: HEADERS,
    });

    const domain = urlparse(url).host;

    if (!username.includes(domain)) {
        username = `${username}@${domain}`;
    }

    const $ = cheerio.load(response);
    const form = $('form#auth_form');
    const payload = {};

    form.find('input').each((_, input) => {
        const $input = $(input);
        payload[$input.attr('name')] = $input.attr('value');
    });

    payload.username = username;
    payload.password = password;

    const r = await session.post({
        url: response.url,
        form: payload,
        headers: HEADERS,
    });

    if (r.includes("auth_form")) {
        throw new Error(`Fail to connect with Oze ENT ${url}: probably wrong login information`);
    }

    const api_url = urlunparse(urlparse(url)._replace('netloc', 'api-' + urlparse(url).host));
    const info_url = urljoin(api_url, '/v1/users/me');
    const infoResponse = await session.get({
        url: info_url,
        headers: HEADERS,
    });
    const info = JSON.parse(infoResponse);
    const ctx_profil = info.currentProfil.codeProfil;
    const ctx_etab = info.currentProfil.uai;
    const ozeapps_url = urljoin(api_url, '/v1/ozapps');
    const ozeappsResponse = await session.get({
        url: ozeapps_url,
        qs: {
            ctx_profil: ctx_profil,
            ctx_etab: ctx_etab,
        },
        headers: HEADERS,
    });
    const ozeapps = JSON.parse(ozeappsResponse);
    let proxysso_url = null;

    for (const app of ozeapps) {
        if (app.code === "pronote") {
            proxysso_url = urljoin(url, app.externalRoute);
            break;
        }
    }

    if (!proxysso_url) {
        const pronoteConfig_url = urljoin(api_url, '/v1/config/Pronote');
        const pronoteConfigResponse = await session.get({
            url: pronoteConfig_url,
            qs: {
                ctx_profil: ctx_profil,
                ctx_etab: ctx_etab,
            },
            headers: HEADERS,
        });
        const pronoteConfig = JSON.parse(pronoteConfigResponse);
        
        if (pronoteConfig.autorisationId && pronoteConfig.projet) {
            proxysso_url = `${url}cas/proxySSO/${pronoteConfig.autorisationId}?uai=${ctx_etab}&projet=${pronoteConfig.projet}&fonction=ELV`;
        }
    }

    const proxyssoResponse = await session.get({
        url: proxysso_url,
        headers: HEADERS,
    });

    return session.cookie();
}

async function _simple_auth(username, password, url = "", form_attr = {}) {
    if (!url) {
        throw new Error("Missing url attribute");
    }

    log.debug(`[ENT ${url}] Logging in with ${username}`);

    const session = request.defaults({ jar: true });
    const response = await session.get({
        url,
        headers: HEADERS,
    });

    const $ = cheerio.load(response);
    const form = $(`form[${form_attr}]`);
    const payload = {};

    form.find('input').each((_, input) => {
        const $input = $(input);
        payload[$input.attr('name')] = $input.attr('value');
    });

    payload.username = username;
    payload.password = password;

    const r = await session.post({
        url: response.url,
        form: payload,
        headers: HEADERS,
    });

    if ($(r).find(`form[${form_attr}]`).length) {
        throw new Error(`Fail to connect with ${url}: probably wrong login information`);
    }

    return session.cookie();
}

module.exports = {
    _cas,
    _cas_edu,
    _open_ent_ng,
    _open_ent_ng_edu,
    _wayf,
    _oze_ent,
    _simple_auth,
};
