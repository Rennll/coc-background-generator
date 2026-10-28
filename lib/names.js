const CULTURES = ["taiwanHan", "japanese"];
const GENDERS = ["male", "female"];
const GENDER_LABELS = { male: "男性常用名", female: "女性常用名" };

function randomIndex(length, random) {
  const value = Number(random());
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error("Random source must return a number from 0 (inclusive) to 1 (exclusive)");
  }
  return Math.floor(value * length);
}

function pick(items, random) {
  return items[randomIndex(items.length, random)];
}

export function validateNameData(data) {
  if (!data || typeof data !== "object" || !data.pools || typeof data.pools !== "object") {
    throw new Error("姓名資料缺少 pools 結構");
  }
  for (const culture of CULTURES) {
    const pool = data.pools[culture];
    if (!pool || typeof pool !== "object" || !Array.isArray(pool.surnames) ||
        !pool.givenNames || typeof pool.givenNames !== "object") {
      throw new Error(`姓名資料缺少文化池：${culture}`);
    }
    for (const [key, values] of [["surnames", pool.surnames], ...GENDERS.map(gender => [`givenNames.${gender}`, pool.givenNames[gender]])]) {
      if (!Array.isArray(values) || values.length === 0 ||
          values.some(value => typeof value !== "string" || !value.trim())) {
        throw new Error(`姓名資料欄位無效或為空：${culture}.${key}`);
      }
      if (new Set(values).size !== values.length) {
        throw new Error(`姓名資料欄位有重複項目：${culture}.${key}`);
      }
    }
    if (pool.period !== "1920-1929") {
      throw new Error(`姓名資料年代範圍不符：${culture}`);
    }
  }
  return true;
}

export function generateName(data, { random = Math.random, excludeNames = [] } = {}) {
  validateNameData(data);
  const excluded = new Set(excludeNames);
  const cultures = CULTURES.filter(culture => data.pools[culture].surnames.length);
  const genders = GENDERS;
  const makeCandidate = (culture, gender) => {
    const pool = data.pools[culture];
    const surname = pick(pool.surnames, random);
    const givenName = pick(pool.givenNames[gender], random);
    return {
      name: `${surname}${givenName}`,
      culture,
      cultureLabel: pool.label,
      gender,
      label: GENDER_LABELS[gender]
    };
  };

  for (let attempt = 0; attempt < 100; attempt++) {
    const candidate = makeCandidate(pick(cultures, random), pick(genders, random));
    if (!excluded.has(candidate.name)) return candidate;
  }

  // Deterministic fallback prevents a constant or heavily constrained RNG from
  // looping forever when there are still unused combinations available.
  const remaining = [];
  for (const culture of cultures) {
    const pool = data.pools[culture];
    for (const gender of genders) {
      for (const surname of pool.surnames) {
        for (const givenName of pool.givenNames[gender]) {
          const name = `${surname}${givenName}`;
          if (!excluded.has(name)) remaining.push({ name, culture, cultureLabel: pool.label, gender, label: GENDER_LABELS[gender] });
        }
      }
    }
  }
  if (!remaining.length) throw new Error("沒有可用且未重複的姓名候選，請重新載入頁面或清空已產生候選");
  return remaining[randomIndex(remaining.length, random)];
}
