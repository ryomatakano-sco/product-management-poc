// Client-side JAN validation — a faithful mirror of backend/app/services/jan.py.
//
// Used so the camera scanner only feeds a *valid* JAN into the lookup: a QR /
// Code-128 / mistyped code is rejected in the browser instead of firing a
// doomed 422 round-trip. The backend still re-validates (defense in depth) —
// these functions must stay in lockstep with jan.py (GS1 mod-10, len 8/13,
// NFKC fold of full-width digits).

// NFKC folds full-width digits (４９０１…) to ASCII (4901…), matching
// unicodedata.normalize("NFKC", ...) on the server.
function plxNormalizeJan(raw) {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).normalize("NFKC").trim();
  if (!s) return null;
  if (!/^[0-9]+$/.test(s)) return null;       // pure digits only, post-NFKC
  if (s.length !== 8 && s.length !== 13) return null;
  return s;
}

// GS1 mod-10: weight the body digits 3-1-3-1 from the rightmost data digit,
// sum, (10 - sum%10)%10 must equal the trailing check digit.
function plxValidateCheckDigit(jan) {
  if (!jan || !/^[0-9]+$/.test(jan)) return false;
  if (jan.length !== 8 && jan.length !== 13) return false;
  const digits = jan.split("").map((c) => parseInt(c, 10));
  const body = digits.slice(0, -1);
  const check = digits[digits.length - 1];
  let weighted = 0;
  // Reverse body so index 0 (rightmost data digit) gets weight 3.
  for (let i = 0; i < body.length; i++) {
    const d = body[body.length - 1 - i];
    weighted += d * (i % 2 === 0 ? 3 : 1);
  }
  const expected = (10 - (weighted % 10)) % 10;
  return expected === check;
}

// One-shot: normalize then check digit. Returns the cleaned JAN string on
// success, or null. (Returning the value, not just a bool, so callers can use
// the normalized form directly.)
function plxCleanJan(raw) {
  const n = plxNormalizeJan(raw);
  if (n === null) return null;
  return plxValidateCheckDigit(n) ? n : null;
}

function plxIsValidJan(raw) {
  return plxCleanJan(raw) !== null;
}

Object.assign(window, {
  plxCleanJan,
  plxIsValidJan,
});
