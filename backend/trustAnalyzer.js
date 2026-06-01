/**
 * trustAnalyzer.js
 *
 * Pure logic (no Express here). Takes a URL string and returns
 * a trust score plus a list of risk indicators.
 */

// --- Environment variables (loaded once when this file is first required) ---

const path = require("path");
const dotenv = require("dotenv");
const cheerio = require("cheerio");
// Load backend/.env into process.env.
// __dirname = folder containing this file (backend/), so .env is found reliably
// even if you start the server from a different working directory.
// Loads backend/.env only (same folder as this file). Do not put .env inside node_modules/.
dotenv.config({ path: path.join(__dirname, ".env"), quiet: true });

/**
 * WhoisXML API key from .env (never put real keys in source code).
 * In backend/.env add: WHOIS_API_KEY=your_key_here
 */
const WHOIS_API_KEY = process.env.WHOIS_API_KEY || "";

/** True when a key is set — useful before calling the WHOIS API later. */
function isWhoisConfigured() {
  return WHOIS_API_KEY.length > 0;
}

/** WhoisXML WHOIS API base URL (GET with query parameters). */
const WHOIS_API_URL =
  "https://www.whoisxmlapi.com/whoisserver/WhoisService";

// --- Google Safe Browsing (detection only — no trust score changes yet) ---

/**
 * API key from backend/.env:
 *   GOOGLE_SAFE_BROWSING_API_KEY=your_key_here
 * Create keys: https://console.cloud.google.com/apis/credentials
 */
const GOOGLE_SAFE_BROWSING_API_KEY =
  process.env.GOOGLE_SAFE_BROWSING_API_KEY || "";

const SAFE_BROWSING_FIND_URL =
  "https://safebrowsing.googleapis.com/v4/threatMatches:find";

/** Identifies this app to Google (required in every request body). */
const SAFE_BROWSING_CLIENT = {
  clientId: "internshield",
  clientVersion: "1.0.0",
};

/**
 * Threat categories we ask Google to check against.
 * @see https://developers.google.com/safe-browsing/v4/reference/rest/v4/ThreatType
 */
const SAFE_BROWSING_THREAT_TYPES = [
  "MALWARE",
  "SOCIAL_ENGINEERING",
  "UNWANTED_SOFTWARE",
  "POTENTIALLY_HARMFUL_APPLICATION",
];

function isSafeBrowsingConfigured() {
  return GOOGLE_SAFE_BROWSING_API_KEY.length > 0;
}

/**
 * Normalize a user URL string for Safe Browsing (must be a valid http/https URL).
 */
function normalizeUrlForSafeBrowsing(rawUrl) {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) {
    throw new Error("No URL provided");
  }
  const withScheme = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withScheme);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https URLs can be checked");
  }
  return parsed.href;
}

/**
 * Build the JSON body for threatMatches:find.
 * @param {string[]} urls - One or more full URLs to check
 */
function buildSafeBrowsingRequestBody(urls) {
  return {
    client: SAFE_BROWSING_CLIENT,
    threatInfo: {
      threatTypes: SAFE_BROWSING_THREAT_TYPES,
      platformTypes: ["ANY_PLATFORM"],
      threatEntryTypes: ["URL"],
      threatEntries: urls.map((url) => ({ url })),
    },
  };
}

/**
 * Low-level call to Google Safe Browsing API.
 *
 * Request flow:
 *   POST .../v4/threatMatches:find?key=API_KEY
 *   Body: { client, threatInfo: { threatTypes, threatEntries: [{ url }] } }
 *   Google compares URLs against malware/phishing blocklists → returns matches[]
 *
 * @param {string[]} urls
 * @returns {Promise<object>} Raw API JSON (includes matches[] when unsafe)
 */
async function fetchSafeBrowsingThreatMatches(urls) {
  if (!isSafeBrowsingConfigured()) {
    throw new Error(
      "GOOGLE_SAFE_BROWSING_API_KEY is missing. Add it to backend/.env (see .env.example)."
    );
  }

  if (!urls.length) {
    throw new Error("At least one URL is required for Safe Browsing lookup");
  }

  const requestUrl = new URL(SAFE_BROWSING_FIND_URL);
  requestUrl.searchParams.set("key", GOOGLE_SAFE_BROWSING_API_KEY);

  const response = await fetch(requestUrl.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildSafeBrowsingRequestBody(urls)),
  });

  const data = await response.json();

  if (!response.ok) {
    const apiError =
      data.error?.message || `Safe Browsing API returned HTTP ${response.status}`;
    console.error("[InternShield] Safe Browsing API error:", {
      status: response.status,
      error: data.error,
      urls,
    });
    throw new Error(apiError);
  }

  return data;
}

/**
 * Interpret Google's response: unsafe if matches[] has one or more entries.
 *
 * API response (simplified):
 *   Safe:   {}  or  { "matches": [] }
 *   Unsafe: { "matches": [{ "threatType": "SOCIAL_ENGINEERING", "threat": { "url": "..." } }, ...] }
 *
 * @param {object} apiResponse - Parsed JSON from fetchSafeBrowsingThreatMatches
 * @returns {{ isUnsafe: boolean, matches: { threatType: string, url: string }[] }}
 */
function parseSafeBrowsingResponse(apiResponse) {
  const rawMatches = apiResponse?.matches || [];

  const matches = rawMatches.map((match) => ({
    threatType: match.threatType || "UNKNOWN",
    url: match.threat?.url || "",
  }));

  return {
    isUnsafe: matches.length > 0,
    matches,
  };
}

/**
 * Check a single URL against Google Safe Browsing (detection only).
 *
 * @param {string} rawUrl - URL from the student
 * @returns {Promise<{
 *   urlChecked: string,
 *   isUnsafe: boolean,
 *   matches: { threatType: string, url: string }[],
 *   skipped: boolean
 * }>}
 */
async function checkUrlWithGoogleSafeBrowsing(rawUrl) {
  if (!isSafeBrowsingConfigured()) {
    return {
      urlChecked: rawUrl || "",
      isUnsafe: false,
      matches: [],
      skipped: true,
      skipReason: "GOOGLE_SAFE_BROWSING_API_KEY not set in .env",
    };
  }

  const urlChecked = normalizeUrlForSafeBrowsing(rawUrl);
  const apiResponse = await fetchSafeBrowsingThreatMatches([urlChecked]);
  const { isUnsafe, matches } = parseSafeBrowsingResponse(apiResponse);

  return {
    urlChecked,
    isUnsafe,
    matches,
    skipped: false,
  };
}

/** Trust score penalty when Google flags the URL on a threat list. */
const SAFE_BROWSING_PENALTY = 50;

/** Turn API threat codes into plain English for students. */
function formatThreatTypeLabel(threatType) {
  const labels = {
    MALWARE: "malware",
    SOCIAL_ENGINEERING: "phishing or social engineering",
    UNWANTED_SOFTWARE: "unwanted software",
    POTENTIALLY_HARMFUL_APPLICATION: "potentially harmful software",
  };
  return labels[threatType] || threatType.replace(/_/g, " ").toLowerCase();
}

/**
 * Apply −50 points and risk text when Safe Browsing reports a match.
 * Detection-only callers use checkUrlWithGoogleSafeBrowsing; scoring stays here.
 *
 * @param {object} checkResult - from checkUrlsWithGoogleSafeBrowsing
 * @returns {{ trustScore: number, safeBrowsingFlagged: boolean, safeBrowsingThreats: string[] }}
 */
function applySafeBrowsingScoring(trustScore, riskIndicators, checkResult) {
  if (checkResult.skipped) {
    riskIndicators.push(
      "Google Safe Browsing check skipped (set GOOGLE_SAFE_BROWSING_API_KEY in backend/.env to enable)."
    );
    return {
      trustScore,
      safeBrowsingFlagged: false,
      safeBrowsingThreats: [],
    };
  }

  if (!checkResult.isUnsafe) {
    return {
      trustScore,
      safeBrowsingFlagged: false,
      safeBrowsingThreats: [],
    };
  }

  const safeBrowsingThreats = [
    ...new Set(
      checkResult.matches.map((m) => formatThreatTypeLabel(m.threatType))
    ),
  ];

  const threatSummary = safeBrowsingThreats.join(", ");

  riskIndicators.push(
    `Google Safe Browsing: this link is flagged as dangerous (${threatSummary}) (−${SAFE_BROWSING_PENALTY} points). ` +
      `Do not enter passwords, download files, or apply until you verify the employer through a trusted source.`
  );

  return {
    trustScore: trustScore - SAFE_BROWSING_PENALTY,
    safeBrowsingFlagged: true,
    safeBrowsingThreats,
  };
}

/**
 * Check one or more URLs (original + final after redirects) in a single API call.
 */
async function checkUrlsWithGoogleSafeBrowsing(rawUrls) {
  if (!isSafeBrowsingConfigured()) {
    return {
      urlsChecked: [],
      isUnsafe: false,
      matches: [],
      skipped: true,
      skipReason: "GOOGLE_SAFE_BROWSING_API_KEY not set in .env",
    };
  }

  const urlsChecked = [
    ...new Set(
      rawUrls.filter(Boolean).map((u) => normalizeUrlForSafeBrowsing(u))
    ),
  ];

  const apiResponse = await fetchSafeBrowsingThreatMatches(urlsChecked);
  const { isUnsafe, matches } = parseSafeBrowsingResponse(apiResponse);

  return {
    urlsChecked,
    isUnsafe,
    matches,
    skipped: false,
  };
}

function logSafeBrowsingError(err, context = {}) {
  console.error("[InternShield] Safe Browsing check failed:", {
    ...context,
    message: err?.message,
    code: err?.code,
    stack: err?.stack,
  });
}

const SAFE_BROWSING_USER_MESSAGE =
  "We could not complete the Google Safe Browsing safety check. Other analysis results still apply.";

const SUSPICIOUS_KEYWORDS = [
  "registration fee",
  "pay fee",
  "upfront payment",
  "wire transfer",
  "send money",
  "guaranteed placement",
  "work from home earn",
  "bitcoin",
  "crypto wallet",
  "whatsapp only",
  "telegram only",
  "no interview",
  "instant offer",
  "processing fee",
  "training fee",
];

/**
 * Hostnames of common URL shortener services (lowercase, no "www.").
 * Scammers often hide the real destination behind these links.
 */
const URL_SHORTENER_HOSTS = [
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "cutt.ly",
];

/**
 * Detect whether a URL points to a known link shortener.
 *
 * Steps:
 *   1. Trim and reject empty input → not a shortener
 *   2. Parse with the URL class (add https:// if the user omitted it)
 *   3. Read hostname and normalize (lowercase, strip "www.")
 *   4. Compare hostname to URL_SHORTENER_HOSTS (exact match)
 *
 * @param {string} rawUrl - Full link from the user (e.g. "https://bit.ly/abc123")
 * @returns {boolean} true if the host is a known shortener, false otherwise
 */
function usesUrlShortener(rawUrl) {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) {
    return false;
  }

  let parsed;
  try {
    parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    // Invalid URL cannot be classified as a shortener
    return false;
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");

  return URL_SHORTENER_HOSTS.includes(hostname);
}

/** Max hops we will follow (stops infinite redirect loops). */
const MAX_REDIRECT_HOPS = 10;

// --- Company domain verification (expand COMPANY_DOMAIN_REGISTRY to add employers) ---

/** Large penalty — impersonation is one of the strongest scam signals. */
const COMPANY_DOMAIN_MISMATCH_PENALTY = 40;

/** When impersonation is detected, score cannot exceed this (blocks "Likely trustworthy"). */
const TRUST_SCORE_CAP_WITH_IMPERSONATION = 45;

/**
 * Official domains and URL keywords for well-known companies.
 * To add a company later: push a new object with id, displayName, officialDomains, urlKeywords.
 */
const COMPANY_DOMAIN_REGISTRY = [
  {
    id: "google",
    displayName: "Google",
    officialDomains: ["google.com", "googleapis.com", "youtube.com"],
    urlKeywords: ["google"],
  },
  {
    id: "microsoft",
    displayName: "Microsoft",
    officialDomains: ["microsoft.com"],
    urlKeywords: ["microsoft"],
  },
  {
    id: "amazon",
    displayName: "Amazon",
    officialDomains: ["amazon.com", "amazonaws.com", "aboutamazon.com"],
    urlKeywords: ["amazon"],
  },
  {
    id: "netflix",
    displayName: "Netflix",
    officialDomains: ["netflix.com"],
    urlKeywords: ["netflix"],
  },
  {
    id: "meta",
    displayName: "Meta",
    officialDomains: ["meta.com", "facebook.com", "fb.com", "instagram.com"],
    urlKeywords: ["meta", "facebook"],
  },
  {
    id: "apple",
    displayName: "Apple",
    officialDomains: ["apple.com"],
    urlKeywords: ["apple"],
  },
  {
    id: "adobe",
    displayName: "Adobe",
    officialDomains: ["adobe.com"],
    urlKeywords: ["adobe"],
  },
  {
    id: "ibm",
    displayName: "IBM",
    officialDomains: ["ibm.com"],
    urlKeywords: ["ibm"],
  },
  {
    id: "oracle",
    displayName: "Oracle",
    officialDomains: ["oracle.com"],
    urlKeywords: ["oracle"],
  },
  {
    id: "intel",
    displayName: "Intel",
    officialDomains: ["intel.com"],
    urlKeywords: ["intel"],
  },
  {
    id: "nvidia",
    displayName: "NVIDIA",
    officialDomains: ["nvidia.com"],
    urlKeywords: ["nvidia"],
  },
  {
    id: "internshala",
    displayName: "Internshala",
    officialDomains: ["internshala.com"],
    urlKeywords: ["internshala"]
  },
  {
    id: "linkedin",
    displayName: "LinkedIn",
    officialDomains: ["linkedin.com"],
    urlKeywords: ["linkedin"]
  },
  {
    id: "indeed",
    displayName: "Indeed",
    officialDomains: ["indeed.com"],
    urlKeywords: ["indeed"]
  },
  {
    id: "naukri",
    displayName: "Naukri",
    officialDomains: ["naukri.com"],
    urlKeywords: ["naukri"]
  },
  {
    id: "glassdoor",
    displayName: "Glassdoor",
    officialDomains: ["glassdoor.com"],
    urlKeywords: ["glassdoor"]
  },
  {
    id: "wellfound",
    displayName: "Wellfound",
    officialDomains: ["wellfound.com"],
    urlKeywords: ["wellfound", "angelco", "angellist"]
  },
  {
    id: "foundit",
    displayName: "Foundit",
    officialDomains: ["foundit.in"],
    urlKeywords: ["foundit", "monster"]
  },
  {
    id: "tcs",
    displayName: "TCS",
    officialDomains: ["tcs.com"],
    urlKeywords: ["tcs"]
  },
  {
    id: "infosys",
    displayName: "Infosys",
    officialDomains: ["infosys.com"],
    urlKeywords: ["infosys"]
  },
  {
    id: "wipro",
    displayName: "Wipro",
    officialDomains: ["wipro.com"],
    urlKeywords: ["wipro"]
  },
  {
    id: "accenture",
    displayName: "Accenture",
    officialDomains: ["accenture.com"],
    urlKeywords: ["accenture"]
  },
  {
    id: "deloitte",
    displayName: "Deloitte",
    officialDomains: ["deloitte.com"],
    urlKeywords: ["deloitte"]
  },
  {
    id: "zoho",
    displayName: "Zoho",
    officialDomains: ["zoho.com"],
    urlKeywords: ["zoho"]
  },
  {
    id: "flipkart",
    displayName: "Flipkart",
    officialDomains: ["flipkart.com"],
    urlKeywords: ["flipkart"]
  },
  {
    id: "swiggy",
    displayName: "Swiggy",
    officialDomains: ["swiggy.com"],
    urlKeywords: ["swiggy"]
  },
  {
    id: "zomato",
    displayName: "Zomato",
    officialDomains: ["zomato.com"],
    urlKeywords: ["zomato"]
  },
  {
    id: "salesforce",
    displayName: "Salesforce",
    officialDomains: ["salesforce.com"],
    urlKeywords: ["salesforce"]
  },
  {
    id: "sap",
    displayName: "SAP",
    officialDomains: ["sap.com"],
    urlKeywords: ["sap"]
  },
  {
    id: "paypal",
    displayName: "PayPal",
    officialDomains: ["paypal.com"],
    urlKeywords: ["paypal"]
  },
  {
    id: "uber",
    displayName: "Uber",
    officialDomains: ["uber.com"],
    urlKeywords: ["uber"]
  },
  {
    id: "airbnb",
    displayName: "Airbnb",
    officialDomains: ["airbnb.com"],
    urlKeywords: ["airbnb"]
  },
  {
    id: "stripe",
    displayName: "Stripe",
    officialDomains: ["stripe.com"],
    urlKeywords: ["stripe"]
  },
  {
    id: "atlassian",
    displayName: "Atlassian",
    officialDomains: ["atlassian.com"],
    urlKeywords: ["atlassian"]
  }
];

/** Trust score penalties for shorteners and redirect chains. */
const SHORTENER_PENALTY = 10;
const SUSPICIOUS_DOMAIN_WORDS = [
  "careers",
  "career",
  "jobs",
  "job",
  "hiring",
  "recruitment",
  "internship",
  "internships"
];

const SUSPICIOUS_TLDS = [
  "xyz",
  "top",
  "click",
  "site",
  "work"
];
const TYPO_REPLACEMENTS = {
  "0": "o",
  "1": "l",
  "3": "e",
  "5": "s",
  "7": "t"
};
const PHISHING_WORDS = [
  "login",
  "signin",
  "verify",
  "secure",
  "account",
  "password",
  "auth"
];
const INTERNSHIP_SCAM_WORDS = [
  "registration",
  "fee",
  "processing",
  "paynow",
  "guaranteed",
  "joiningfee",
  "instantoffer"
];
const PERSONAL_EMAIL_PROVIDERS = [
  "@gmail.com",
  "@yahoo.com",
  "@hotmail.com",
  "@outlook.com"
];
const PAYMENT_METHOD_KEYWORDS = [
  "upi",
  "upi id",
  "phonepe",
  "paytm",
  "google pay",
  "gpay"
];
const REDIRECT_MODERATE_PENALTY = 5; // 1–2 redirects
const REDIRECT_EXCESSIVE_PENALTY = 15; // more than 3 redirects (i.e. 4+)
const REDIRECT_MODERATE_MAX = 2;
const REDIRECT_EXCESSIVE_MIN = 4;

/** How long to wait per HTTP request while following redirects. */
const REDIRECT_FETCH_TIMEOUT_MS = 10_000;

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

/** Shown in API/UI — never includes fetch, stack traces, or other internals. */
const REDIRECT_USER_MESSAGE_DEFAULT =
  "Could not fully inspect redirect behavior. Other checks still ran using the URL you entered.";

/**
 * Write full technical details to the server console (for developers only).
 */
function logRedirectAnalysisError(err, context = {}) {
  console.error("[InternShield] Redirect analysis failed:", {
    ...context,
    message: err?.message,
    code: err?.code,
    cause:
      err?.cause instanceof Error
        ? err.cause.message
        : err?.cause ?? undefined,
    stack: err?.stack,
  });
}

/**
 * Map internal redirect failures to student-friendly risk indicator text.
 */
function getRedirectUserMessage(err) {
  const detail = (err?.message || "").toLowerCase();

  if (detail.includes("unsafe protocol") || detail.includes("redirect blocked")) {
    return (
      "Could not fully inspect redirect behavior. The link tried to send us somewhere " +
      "we cannot safely verify. Other checks still ran using the URL you entered."
    );
  }

  if (detail.includes("exceeded") && detail.includes("hop")) {
    return (
      "Could not fully inspect redirect behavior. This link redirected too many times " +
      "to verify. Other checks still ran using the URL you entered."
    );
  }

  if (detail.includes("only http and https")) {
    return (
      "Could not fully inspect redirect behavior. This type of web address cannot be " +
      "checked for redirects. Other checks still ran using the URL you entered."
    );
  }

  // fetch failed, timeouts, connection reset, DNS issues, etc.
  return REDIRECT_USER_MESSAGE_DEFAULT;
}

/**
 * Only http/https URLs are allowed — blocks javascript:, file:, data:, etc.
 */
function isSafeHttpUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Follow HTTP redirects manually so we can count each hop safely.
 *
 * Safety rules:
 *   - Only follow http/https links
 *   - Cap at MAX_REDIRECT_HOPS to prevent loops
 *   - Per-request timeout (AbortSignal.timeout)
 *   - Use redirect: "manual" so fetch does not auto-follow (we count each step)
 *   - Resolve relative Location headers against the current URL
 *
 * @param {string} startUrl - Normalized URL to start from
 * @returns {Promise<{
 *   finalUrl: string,
 *   redirectCount: number,
 *   redirectChain: string[]
 * }>}
 */
async function followRedirectsSafely(startUrl) {
  if (!isSafeHttpUrl(startUrl)) {
    throw new Error("Only http and https URLs can be followed");
  }

  let currentUrl = startUrl;
  let redirectCount = 0;
  const redirectChain = [startUrl];

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    const response = await fetch(currentUrl, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(REDIRECT_FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent": "InternShield/1.0 (internship trust analyzer)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    const isRedirect =
      REDIRECT_STATUS_CODES.has(response.status) ||
      (response.status >= 300 && response.status < 400);

    if (!isRedirect) {
      // Final response (200, 403, 404, etc.) — we stop here; URL is the destination
      return { finalUrl: currentUrl, redirectCount, redirectChain };
    }

    const locationHeader = response.headers.get("location");
    if (!locationHeader) {
      return { finalUrl: currentUrl, redirectCount, redirectChain };
    }

    const nextUrl = new URL(locationHeader.trim(), currentUrl).href;

    if (!isSafeHttpUrl(nextUrl)) {
      throw new Error("Redirect blocked: destination uses an unsafe protocol");
    }

    redirectCount++;
    currentUrl = nextUrl;
    redirectChain.push(currentUrl);

    if (redirectCount > MAX_REDIRECT_HOPS) {
      throw new Error(
        `Redirect chain exceeded ${MAX_REDIRECT_HOPS} hops (stopped for safety)`
      );
    }
  }

  return { finalUrl: currentUrl, redirectCount, redirectChain };
}

/**
 * Penalty when the original link uses a known URL shortener (bit.ly, t.co, etc.).
 */
function applyShortenerScoring(trustScore, riskIndicators, isShortener) {
  if (!isShortener) return trustScore;

  riskIndicators.push(
    `Known URL shortener detected (−${SHORTENER_PENALTY} points — real destination is hidden)`
  );
  return trustScore - SHORTENER_PENALTY;
}

/**
 * Penalty based on how many HTTP redirects occur before the final page.
 *
 * Tiers (only one redirect tier applies):
 *   0 redirects     → no redirect penalty
 *   1–2 redirects   → −5  (short chain, still somewhat suspicious)
 *   3 redirects     → no extra penalty (gap between moderate and excessive)
 *   4+ redirects    → −15 (excessive — often used to obscure the real site)
 */
function applyRedirectScoring(trustScore, riskIndicators, redirectCount) {
  if (redirectCount >= REDIRECT_EXCESSIVE_MIN) {
    riskIndicators.push(
      `Excessive redirects: ${redirectCount} hops (−${REDIRECT_EXCESSIVE_PENALTY} points — may hide the real destination)`
    );
    return trustScore - REDIRECT_EXCESSIVE_PENALTY;
  }

  if (redirectCount >= 1 && redirectCount <= REDIRECT_MODERATE_MAX) {
    riskIndicators.push(
      `${redirectCount} redirect(s) before final page (−${REDIRECT_MODERATE_PENALTY} points)`
    );
    return trustScore - REDIRECT_MODERATE_PENALTY;
  }

  if (redirectCount === 3) {
    riskIndicators.push(
      "3 redirects before final page (no extra penalty, but worth reviewing the final URL)"
    );
  }

  return trustScore;
}

/**
 * True if hostname is the official domain or a subdomain (e.g. careers.google.com).
 */
function isOfficialCompanyDomain(hostname, officialDomains) {
  const host = hostname.toLowerCase().replace(/^www\./, "");

  return officialDomains.some((official) => {
    const root = official.toLowerCase();
    return host === root || host.endsWith(`.${root}`);
  });
}

/**
 * Split a URL into lowercase "words" from the hostname and path (beginner-friendly matching).
 */
function getUrlTextSegments(urlString) {
  try {
    const parsed = new URL(
      urlString.includes("://") ? urlString : `https://${urlString}`
    );
    const combined = `${parsed.hostname}${parsed.pathname}`.toLowerCase();
    return combined.split(/[^a-z0-9]+/).filter(Boolean);
  } catch {
    return [];
  }
}
function normalizeTyposquatting(text) {
  let normalized = text.toLowerCase();

  Object.entries(TYPO_REPLACEMENTS).forEach(
    ([fake, real]) => {
      normalized =
        normalized.replaceAll(fake, real);
    }
  );

  return normalized;
}

/**
 * Does this URL text contain a company keyword (e.g. "google" in google-jobs or /microsoft/)?
 */
function urlMentionsCompanyKeyword(urlString, keyword) {
  const kw = keyword.toLowerCase();
  return getUrlTextSegments(urlString).some(
    (segment) =>
      segment === kw ||
      segment.startsWith(`${kw}-`) ||
      segment.endsWith(`-${kw}`) ||
      segment.includes(`-${kw}-`)
  );
}

/**
 * Find registry entries whose keywords appear in the given URL.
 */
function detectCompanyMentionsInUrl(urlString) {
  const mentioned = [];

  for (const company of COMPANY_DOMAIN_REGISTRY) {
    const found = company.urlKeywords.some((keyword) =>
      urlMentionsCompanyKeyword(urlString, keyword)
    );
    if (found) {
      mentioned.push(company);
    }
  }

  return mentioned;
}

/**
 * Compare mentioned companies to the real hostname after redirects.
 * @returns {{ company: object, actualDomain: string }[]}
 */
function findCompanyDomainMismatches(urlsToScan, actualHostname) {
  const seenIds = new Set();
  const mentionedCompanies = [];

  for (const url of urlsToScan) {
    for (const company of detectCompanyMentionsInUrl(url)) {
      if (!seenIds.has(company.id)) {
        seenIds.add(company.id);
        mentionedCompanies.push(company);
      }
    }
  }

  const mismatches = [];

  for (const company of mentionedCompanies) {
    if (!isOfficialCompanyDomain(actualHostname, company.officialDomains)) {
      mismatches.push({
        company,
        actualDomain: actualHostname.toLowerCase().replace(/^www\./, ""),
      });
    }
  }

  return mismatches;
}

/**
 * Build a plain-language warning students can act on.
 */
function formatImpersonationMessage(company, actualDomain) {
  const officialExample = company.officialDomains[0];
  return (
    `Possible fake ${company.displayName} posting: the link mentions ${company.displayName}, ` +
    `but this page is hosted on "${actualDomain}" — not an official site like ${officialExample}. ` +
    `Do not sign in or share personal details until you confirm the employer on their real careers page.`
  );
}

/**
 * If the URL suggests a well-known company but the domain is not official:
 *   −40 points, cap score at 45, set impersonationRisk for the UI.
 *
 * @returns {{ trustScore: number, impersonationRisk: boolean, impersonatedCompanies: string[] }}
 */
function applyCompanyDomainVerification(
  trustScore,
  riskIndicators,
  { urlChecked, finalUrl, actualHostname }
) {
  const urlsToScan = [urlChecked, finalUrl].filter(Boolean);
  const mismatches = findCompanyDomainMismatches(urlsToScan, actualHostname);

  if (mismatches.length === 0) {
    return {
      trustScore,
      impersonationRisk: false,
      impersonatedCompanies: [],
    };
  }

  const impersonatedCompanies = [];

  for (const { company, actualDomain } of mismatches) {
    impersonatedCompanies.push(company.displayName);
    riskIndicators.push(formatImpersonationMessage(company, actualDomain));
  }

  const penalizedScore = trustScore - COMPANY_DOMAIN_MISMATCH_PENALTY;
  const cappedScore = Math.min(penalizedScore, TRUST_SCORE_CAP_WITH_IMPERSONATION);

  riskIndicators.push(
    `Impersonation check: −${COMPANY_DOMAIN_MISMATCH_PENALTY} points (score capped at ${TRUST_SCORE_CAP_WITH_IMPERSONATION} while a company name/domain mismatch exists).`
  );

  return {
    trustScore: cappedScore,
    impersonationRisk: true,
    impersonatedCompanies,
  };
}

/**
 * Step A — Extract the registrable domain from a full internship URL.
 *
 * Example: "https://jobs.google.com/intern" → hostname "jobs.google.com"
 * We strip "www." and return "jobs.google.com" for the WHOIS lookup.
 *
 * @param {string} rawUrl
 * @returns {{ domain: string, hostname: string, urlChecked: string }}
 * @throws {Error} If the URL is empty, invalid, or uses an IP instead of a domain
 */
function extractDomainFromUrl(rawUrl) {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) {
    throw new Error("No URL provided");
  }

  let parsed;
  try {
    parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error("URL format is invalid");
  }

  const hostname = parsed.hostname.toLowerCase();

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    throw new Error("Cannot run WHOIS on an IP address — use a domain name");
  }

  // Remove leading "www." so whois lookup uses example.com not www.example.com
  const domain = hostname.replace(/^www\./, "");

  return {
    domain,
    hostname,
    urlChecked: parsed.href,
  };
}

/**
 * Step B — Ask WhoisXML for WHOIS data and read the domain creation date.
 *
 * API request flow (see README or comments below):
 *   1. Build GET URL with apiKey + domainName + outputFormat=JSON
 *   2. fetch() → WhoisXML servers
 *   3. Parse JSON → WhoisRecord.createdDate (or registryData fallback)
 *
 * @param {string} domain - e.g. "google.com" (from extractDomainFromUrl)
 * @returns {Promise<{
 *   domain: string,
 *   creationDate: string | null,
 *   creationDateNormalized: string | null,
 *   whoisRaw?: object
 * }>}
 */
async function fetchDomainCreationDate(domain) {
  if (!isWhoisConfigured()) {
    throw new Error(
      "WHOIS_API_KEY is missing. Add it to backend/.env (see .env.example)."
    );
  }

  // --- 1. Build the request URL (query string = parameters after ?) ---
  const requestUrl = new URL(WHOIS_API_URL);
  requestUrl.searchParams.set("apiKey", WHOIS_API_KEY);
  requestUrl.searchParams.set("domainName", domain);
  requestUrl.searchParams.set("outputFormat", "JSON");

  // --- 2. Send HTTP GET to WhoisXML ---
  const response = await fetch(requestUrl.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const data = await response.json();

  // WhoisXML returns an ErrorMessage object when the call fails
  if (data.ErrorMessage) {
    const msg = data.ErrorMessage.msg || data.ErrorMessage.errorCode || "WHOIS API error";
    throw new Error(msg);
  }

  if (!response.ok) {
    throw new Error(`WHOIS API returned HTTP ${response.status}`);
  }

  // --- 3. Read creation date from the JSON body ---
  // Top-level key is usually "WhoisRecord". Some TLDs only fill registryData.
  const record = data.WhoisRecord || {};
  const registry = record.registryData || {};

  const creationDate =
    record.createdDate ||
    registry.createdDate ||
    null;

  const creationDateNormalized =
    record.createdDateNormalized ||
    registry.createdDateNormalized ||
    null;

  return {
    domain,
    creationDate,
    creationDateNormalized,
  };
}

/**
 * Convenience: extract domain from a user URL, then fetch creation date from WhoisXML.
 *
 * @param {string} rawUrl - Full URL from the student (e.g. internship posting link)
 * @returns {Promise<{
 *   domain: string,
 *   hostname: string,
 *   urlChecked: string,
 *   creationDate: string | null,
 *   creationDateNormalized: string | null
 * }>}
 */
async function lookupDomainCreationDate(rawUrl) {
  const { domain, hostname, urlChecked } = extractDomainFromUrl(rawUrl);
  const whois = await fetchDomainCreationDate(domain);

  return {
    domain,
    hostname,
    urlChecked,
    creationDate: whois.creationDate,
    creationDateNormalized: whois.creationDateNormalized,
  };
}

/**
 * Convert a WHOIS creation date string into age in whole days (today − created).
 *
 * @param {string | null} creationDate - from WhoisXML (raw or normalized)
 * @returns {number | null} Days since registration, or null if unparseable
 */
function calculateDomainAgeDays(creationDate) {
  if (!creationDate) return null;

  const created = new Date(creationDate);
  if (Number.isNaN(created.getTime())) return null;

  const msPerDay = 1000 * 60 * 60 * 24;
  const diffMs = Date.now() - created.getTime();

  // Future dates are invalid for our scoring
  if (diffMs < 0) return null;

  return Math.floor(diffMs / msPerDay);
}

/**
 * Apply trust score penalties based on how new the domain is.
 *
 * Rules (only one applies — checked from strictest first):
 *   - under 30 days  → −25 points
 *   - under 180 days → −10 points
 *   - otherwise      → no penalty (optional positive note)
 *
 * @returns {number} Updated trust score
 */
function applyDomainAgeScoring(trustScore, riskIndicators, domainAgeDays) {
  if (domainAgeDays === null) return trustScore;

  if (domainAgeDays < 30) {
    riskIndicators.push(
      `Domain is only ${domainAgeDays} days old (very new — common scam signal)`
    );
    return trustScore - 25;
  }

  if (domainAgeDays < 180) {
    riskIndicators.push(
      `Domain is ${domainAgeDays} days old (less than 6 months — proceed with caution)`
    );
    return trustScore - 10;
  }

  riskIndicators.push(
    `Domain is ${domainAgeDays} days old (established registration)`
  );
  return trustScore;
}

/**
 * Run URL-based checks (HTTPS, keywords, hostname shape).
 * Returns partial result or null if URL is invalid (caller handles early exit).
 */
function runUrlChecks(parsed, urlChecked) {
  const riskIndicators = [];
  let trustScore = 100;

  const lowerFull = urlChecked.toLowerCase();
  const normalizedForKeywords = lowerFull.replace(/[-_]/g, " ");

  if (parsed.protocol !== "https:") {
    riskIndicators.push("URL does not use HTTPS (connection may not be encrypted)");
    trustScore -= 25;
  }

  const matchedKeywords = SUSPICIOUS_KEYWORDS.filter((keyword) =>
    normalizedForKeywords.includes(keyword)
  );

  if (matchedKeywords.length > 0) {
    matchedKeywords.forEach((keyword) => {
      riskIndicators.push(`Suspicious keyword in URL: "${keyword}"`);
    });
    trustScore -= Math.min(50, matchedKeywords.length * 15);
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(parsed.hostname)) {
    riskIndicators.push("URL uses an IP address instead of a domain name");
    trustScore -= 15;
  }

  if (parsed.hostname.split(".").length > 4) {
    riskIndicators.push("Unusually long subdomain chain (possible phishing)");
    trustScore -= 10;
  }

  return { trustScore, riskIndicators };
}

/**
 * Full analysis: URL checks + WHOIS domain age + combined trust score.
 *
 * @param {string} rawUrl - URL typed by the student
 * @returns {Promise<{
 *   trustScore: number,
 *   riskIndicators: string[],
 *   urlChecked: string,
 *   domain: string | null,
 *   domainAgeDays: number | null,
 *   redirectCount: number,
 *   finalUrl: string | null,
 *   impersonationRisk: boolean,
 *   impersonatedCompanies: string[],
 *   safeBrowsingFlagged: boolean,
 *   safeBrowsingThreats: string[]
 * }>}
 */
async function fetchPageContent(url) {
  try {
    const response = await fetch(url, {
      redirect: "follow"
    });

    const html = await response.text();

    const $ = cheerio.load(html);

    return $("body").text().toLowerCase();
  } catch {
    return "";
  }
}
function analyzePageText(text) {
  const findings = [];

  const CONTENT_SCAM_PATTERNS = [
    {
      phrase: "registration fee",
      message: "Page mentions a registration fee"
    },
    {
      phrase: "processing fee",
      message: "Page mentions a processing fee"
    },
    {
      phrase: "training fee",
      message: "Page mentions a training fee"
    },
    {
      phrase: "guaranteed placement",
      message: "Page promises guaranteed placement"
    },
    {
      phrase: "no interview",
      message: "Page claims no interview is required"
    },
    {
      phrase: "whatsapp",
      message: "Page relies on WhatsApp communication"
    },
    {
      phrase: "telegram",
      message: "Page relies on Telegram communication"
    },
    {
      phrase: "application fee",
      message: "Page requires an application fee"
    },
    {
      phrase: "pay now",
      message: "Page requests immediate payment"
    },
    {
      phrase: "registration amount",
      message: "Page requests a registration payment"
    },
    {
      phrase: "joining fee",
      message: "Page requests a joining fee"
    },
    {
      phrase: "security deposit",
      message: "Page requests a security deposit"
    },
    {
      phrase: "whatsapp recruiter",
      message: "Recruitment through WhatsApp detected"
    },
    {
      phrase: "message hr on whatsapp",
      message: "HR contact through WhatsApp detected"
    },
    {
      phrase: "join telegram",
      message: "Recruitment through Telegram detected"
    },
    {
      phrase: "telegram group",
      message: "Recruitment Telegram group detected"
    },
    {
      phrase: "limited seats",
      message: "Page uses urgency language (limited seats)"
    },
    {
      phrase: "apply now",
      message: "Page pressures users to apply immediately"
    },
    {
      phrase: "last chance",
      message: "Page uses urgency language (last chance)"
    },
    {
      phrase: "urgent hiring",
      message: "Page claims urgent hiring"
    },
    {
      phrase: "immediate joining",
      message: "Page promises immediate joining"
    },
    {
      phrase: "hurry up",
      message: "Page uses pressure tactics"
    },
    {
      phrase: "only today",
      message: "Page uses time-pressure tactics"
    },
    {
      phrase: "guaranteed internship",
      message: "Page promises a guaranteed internship"
    },
    {
      phrase: "100% placement",
      message: "Page promises 100% placement"
    },
    {
      phrase: "100% job guarantee",
      message: "Page promises a job guarantee"
    },
    {
      phrase: "assured placement",
      message: "Page promises assured placement"
    },
    {
      phrase: "assured job",
      message: "Page promises an assured job"
    },
    {
      phrase: "selection guaranteed",
      message: "Page guarantees candidate selection"
    },
    {
      phrase: "job confirmed",
      message: "Page claims jobs are already confirmed"
    }
  ];

  for (const rule of CONTENT_SCAM_PATTERNS) {
    if (text.includes(rule.phrase)) {
      findings.push(rule.message);
    }
  }
/* Rule 14 */
const lowerText = text.toLowerCase();

const hasPersonalEmail =
  PERSONAL_EMAIL_PROVIDERS.some(
    provider =>
      lowerText.includes(provider)
  );

if (hasPersonalEmail) {
  findings.push(
    "Personal email address detected on page"
  );
}
const rupeePattern =
  /₹\s?\d+/g;

const rupeeMatches =
  text.match(rupeePattern) || [];

if (rupeeMatches.length > 0) {
  findings.push(
    "Page contains payment amounts"
  );
}
const whatsappRecruitment =
  lowerText.includes("whatsapp") &&
  (
    lowerText.includes("resume") ||
    lowerText.includes("cv") ||
    lowerText.includes("hr") ||
    lowerText.includes("recruiter")
  );

if (whatsappRecruitment) {
  findings.push(
    "WhatsApp-based recruitment process detected"
  );
}
const urgencyCount = [
  "apply now",
  "limited seats",
  "last chance",
  "urgent hiring",
  "immediate joining",
  "hurry up"
].filter(
  phrase => lowerText.includes(phrase)
).length;

if (urgencyCount >= 2) {
  findings.push(
    "Multiple urgency signals detected"
  );
}
const guaranteeCount = [
  "guaranteed internship",
  "100% placement",
  "100% job guarantee",
  "assured placement",
  "assured job",
  "selection guaranteed"
].filter(
  phrase => lowerText.includes(phrase)
).length;

if (guaranteeCount >= 2) {
  findings.push(
    "Multiple guaranteed-placement claims detected"
  );
}
/* Rule 19 */

const paymentMatches =
  PAYMENT_METHOD_KEYWORDS.filter(
    keyword =>
      lowerText.includes(keyword)
  );

if (paymentMatches.length > 0) {
  findings.push(
    "Direct payment methods detected on page"
  );
}
  return findings;
}
async function analyzeInternshipUrl(rawUrl) {
  const trimmed = (rawUrl || "").trim();

  if (!trimmed) {
    return {
      trustScore: 0,
      riskIndicators: ["No URL provided"],
      urlChecked: "",
      domain: null,
      domainAgeDays: null,
      redirectCount: 0,
      finalUrl: null,
      impersonationRisk: false,
      impersonatedCompanies: [],
      safeBrowsingFlagged: false,
      safeBrowsingThreats: [],
    };
  }

  let parsed;
  try {
    parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return {
      trustScore: 0,
      riskIndicators: ["URL format is invalid"],
      urlChecked: trimmed,
      domain: null,
      domainAgeDays: null,
      redirectCount: 0,
      finalUrl: null,
      impersonationRisk: false,
      impersonatedCompanies: [],
      safeBrowsingFlagged: false,
      safeBrowsingThreats: [],
    };
  }

  const urlChecked = parsed.href;
  const urlResult = runUrlChecks(parsed, urlChecked);
  let trustScore = urlResult.trustScore;
  const riskIndicators = urlResult.riskIndicators;
  let suspiciousSignalCount = 0;
  trustScore = applyShortenerScoring(
    trustScore,
    riskIndicators,
    usesUrlShortener(urlChecked)
  );
  const hostname = parsed.hostname.toLowerCase();
  const normalizedHostname =
  normalizeTyposquatting(hostname);
  const digitCount =
  (hostname.match(/\d/g) || []).length;

if (digitCount >= 4) {
  trustScore -= 10;

  riskIndicators.push(
    "Domain contains excessive numeric characters"
  );
}
if (digitCount >= 8) {
  trustScore -= 15;

  riskIndicators.push(
    "Domain contains an unusually high number of digits"
  );
}
  /* Rule 2 */
  const suspiciousWords =
    SUSPICIOUS_DOMAIN_WORDS.filter(word =>
      hostname.includes(word)
    );
  
    if (suspiciousWords.length > 0) {
      suspiciousSignalCount++;
    trustScore -= 10;
  
    riskIndicators.push(
      "Hiring-related keyword detected in domain"
    );
  }
  const phishingWords =
  PHISHING_WORDS.filter(word =>
    hostname.includes(word)
  );

if (phishingWords.length > 0) {
  suspiciousSignalCount++;

  trustScore -= 15;

  riskIndicators.push(
    "Phishing-related keywords detected in domain"
  );
}
const matchedInternshipScamWords =
INTERNSHIP_SCAM_WORDS.filter(word =>
    hostname.includes(word)
  );

if (matchedInternshipScamWords.length > 0) {
  suspiciousSignalCount++;

  trustScore -= 15;

  riskIndicators.push(
    "Potential internship scam terminology detected"
  );
}
  const mentionedCompanies =
  detectCompanyMentionsInUrl(urlChecked);
  const typoCompanies =
  detectCompanyMentionsInUrl(
    normalizedHostname
  );
if (
  mentionedCompanies.length > 0 &&
  suspiciousWords.length > 0
) {
  suspiciousSignalCount++;
  trustScore -= 15;

  riskIndicators.push(
    "Company name combined with hiring keywords in domain"
  );
}
if (
  typoCompanies.length > 0 &&
  hostname !== normalizedHostname &&
  !hostname.includes(
    typoCompanies[0].urlKeywords[0]
  )
){
  trustScore -= 20;

  suspiciousSignalCount++;

  riskIndicators.push(
    "Possible typosquatting detected"
  );
}
  /* Rule 3 */
  const hyphenCount =
    (hostname.match(/-/g) || []).length;
  
    if (hyphenCount >= 2) {
      suspiciousSignalCount++;
    trustScore -= 10;
  
    riskIndicators.push(
      "Domain contains multiple hyphens"
    );
  }
  
  /* Rule 4 */
  const tld =
    hostname.split(".").pop();
  
    if (SUSPICIOUS_TLDS.includes(tld)) {
      suspiciousSignalCount++;
    trustScore -= 10;
  
    riskIndicators.push(
      `Suspicious top-level domain (.${tld})`
    );
  }
  
  let domain = null;
  let domainAgeDays = null;
  let redirectCount = 0;
  let finalUrl = urlChecked;
  let impersonationRisk = false;
  let impersonatedCompanies = [];
  let safeBrowsingFlagged = false;
  let safeBrowsingThreats = [];
  let pageContentWarnings = [];
  // --- Check 3: Follow redirects safely and score long chains ---
  try {
    const redirectResult = await followRedirectsSafely(urlChecked);
    redirectCount = redirectResult.redirectCount;
    finalUrl = redirectResult.finalUrl;

    trustScore = applyRedirectScoring(
      trustScore,
      riskIndicators,
      redirectCount
    );

    if (finalUrl !== urlChecked) {
      riskIndicators.push(`Final destination after redirects: ${finalUrl}`);
    }
  } catch (err) {
    logRedirectAnalysisError(err, { urlChecked });
    riskIndicators.push(getRedirectUserMessage(err));
  }

  // --- Check 4: Company name in URL vs actual domain (impersonation detection) ---
  try {
    const hostnameForCheck = new URL(finalUrl).hostname;
    const companyCheck = applyCompanyDomainVerification(
      trustScore,
      riskIndicators,
      {
        urlChecked,
        finalUrl,
        actualHostname: hostnameForCheck,
      }
    );
    trustScore = companyCheck.trustScore;
impersonationRisk = companyCheck.impersonationRisk;
impersonatedCompanies = companyCheck.impersonatedCompanies;

if (impersonationRisk) {
  suspiciousSignalCount++;
}
  } catch (err) {
    riskIndicators.push(
      `We could not verify whether this is an official company website (${err.message}).`
    );
  }

  // --- Check 5: Google Safe Browsing (original + final URL) ---
  try {
    const urlsForSafeBrowsing =
      finalUrl === urlChecked ? [finalUrl] : [urlChecked, finalUrl];
    const safeBrowsingCheck = await checkUrlsWithGoogleSafeBrowsing(
      urlsForSafeBrowsing
    );
    const safeBrowsingScoring = applySafeBrowsingScoring(
      trustScore,
      riskIndicators,
      safeBrowsingCheck
    );
    trustScore = safeBrowsingScoring.trustScore;
    safeBrowsingFlagged = safeBrowsingScoring.safeBrowsingFlagged;
    safeBrowsingThreats = safeBrowsingScoring.safeBrowsingThreats;
  } catch (err) {
    logSafeBrowsingError(err, { urlChecked, finalUrl });
    riskIndicators.push(SAFE_BROWSING_USER_MESSAGE);
  }
// --- Check 5.5: Page Content Analysis ---
try {
  const pageText =
    await fetchPageContent(finalUrl);

  pageContentWarnings =
    analyzePageText(pageText);

    if (pageContentWarnings.length > 0) {

      const contentPenalty =
        Math.min(
          40,
          pageContentWarnings.length * 10
        );
    
      trustScore -= contentPenalty;
    suspiciousSignalCount++;

    pageContentWarnings.forEach(
      warning => {
        riskIndicators.push(warning);
      }
    );
  }
} catch {
  // Ignore content analysis failures
}
  // --- Check 6: Domain age via WhoisXML (uses final URL after redirects) ---
  try {
    const extracted = extractDomainFromUrl(finalUrl);
    domain = extracted.domain;

    if (!isWhoisConfigured()) {
      riskIndicators.push(
        "Domain age check skipped (set WHOIS_API_KEY in backend/.env to enable)"
      );
    } else {
      const whois = await fetchDomainCreationDate(domain);
      const creationDate =
        whois.creationDateNormalized || whois.creationDate;

      domainAgeDays = calculateDomainAgeDays(creationDate);

      if (domainAgeDays === null) {
        riskIndicators.push(
          "Could not determine domain age from WHOIS (missing or unparseable creation date)"
        );
      } else {
        trustScore = applyDomainAgeScoring(
          trustScore,
          riskIndicators,
          domainAgeDays
        );
      }
    }
  } catch (err) {
    riskIndicators.push(`Domain age check failed: ${err.message}`);
  }
  if (suspiciousSignalCount >= 3) {
    trustScore -= 15;
  
    riskIndicators.push(
      "Multiple suspicious domain signals detected"
    );
  }
  trustScore = Math.max(0, Math.min(100, trustScore));

  if (riskIndicators.length === 0) {
    riskIndicators.push("No major red flags detected");
  }

  return {
    trustScore,
    riskIndicators,
    urlChecked,
    domain,
    domainAgeDays,
    redirectCount,
    finalUrl,
    impersonationRisk,
    impersonatedCompanies,
    safeBrowsingFlagged,
    safeBrowsingThreats,
  };
}

module.exports = {
  analyzeInternshipUrl,
  SUSPICIOUS_KEYWORDS,
  URL_SHORTENER_HOSTS,
  COMPANY_DOMAIN_REGISTRY,
  usesUrlShortener,
  followRedirectsSafely,
  logRedirectAnalysisError,
  getRedirectUserMessage,
  applyShortenerScoring,
  applyRedirectScoring,
  detectCompanyMentionsInUrl,
  findCompanyDomainMismatches,
  applyCompanyDomainVerification,
  isWhoisConfigured,
  isSafeBrowsingConfigured,
  checkUrlWithGoogleSafeBrowsing,
  checkUrlsWithGoogleSafeBrowsing,
  applySafeBrowsingScoring,
  fetchSafeBrowsingThreatMatches,
  parseSafeBrowsingResponse,
  buildSafeBrowsingRequestBody,
  extractDomainFromUrl,
  fetchDomainCreationDate,
  lookupDomainCreationDate,
  calculateDomainAgeDays,
  applyDomainAgeScoring,
};
