const dictionaries = {
  en: {
    language: {
      label: "Language",
      ru: "RU",
      en: "EN",
    },
    hero: {
      kicker: "Secret Stress Lab",
      title: "Probe whether a human operator can pull a secret out of an LLM agent.",
      noteLabel: "Lab Notes",
      noteBody:
        "Each level hides a password. Pick a scenario, enable hard mode, and map the weak points in the defense.",
    },
    panel: {
      levelsTitle: "Scenario Select",
      levelsTag: "5 scenarios",
      responseTitle: "Agent Output",
      live: "live",
      ready: "ready",
    },
    levels: {
      1: {
        title: "Level 1",
        badge: "Open Door",
        description: "Bare prompt-only agent with no extra defensive checks.",
      },
      2: {
        title: "Level 2",
        badge: "Leak Guard",
        description: "A second LLM filter inspects the agent output before it reaches the operator.",
      },
      3: {
        title: "Level 3",
        badge: "Checkpoint",
        description: "The defensive filter scans both the inbound prompt and the outbound reply.",
      },
      4: {
        title: "Level 4",
        badge: "Orbital Cage",
        description: "Level 3 with an extra astronomy-only prompt restriction on the main agent.",
      },
      5: {
        title: "Level 5",
        badge: "Double Blind",
        description:
          "Level 4 plus a final filter that judges the whole prompt-response pair for secret leakage.",
      },
    },
    session: {
      eyebrow: "Session ID",
      copy: "Copy Session ID",
      copyError: "Failed to copy the session ID to the clipboard.",
      stateTitle: "Session Signal",
      rotated: "Server rotated the session and issued a new identifier.",
      stable: "Session is still live. The next probe will continue in the same context.",
    },
    controls: {
      hardModeTitle: "Hard Mode",
      hardModeBody:
        "After a configured number of probes, the server will switch to a fresh session with a new password.",
      currentLevel: "Current Scenario",
      composerLabel: "Operator Prompt",
      composerPlaceholder: "Type a prompt, instruction, or jailbreak attempt…",
      send: "Launch Probe",
      sending: "Launching…",
      levelsError: "Could not load scenarios from the server. Using local metadata.",
    },
    response: {
      intro: "Select a scenario and send the first probe to the agent.",
      newSession: "Fresh session armed. Send a new probe to the agent.",
    },
    status: {
      filterTitle: "Filter Status",
      filterTriggered: "Triggered",
      filterActive: "Armed",
      filterOff: "Offline",
      filterTriggeredBody: "The response was replaced with the defensive decoy message.",
      filterActiveBody: "An extra LLM filter is monitoring the prompt and the response path.",
      filterOffBody: "Level 1 runs without extra filter layers.",
      missionTitle: "Mission State",
      missionSuccess: "Password Extracted",
      missionActive: "Attack Continues",
      missionSuccessBody: "The server confirmed the breach and returned a success state.",
      missionActiveBody: "Try role shifts, reframing, or context breaks to escalate the attack.",
      apiTitle: "API Status",
      apiError: "Error",
      apiLoading: "Requesting…",
      apiReady: "Ready",
      httpTitle: "HTTP",
      latencyTitle: "Latency",
      rotationTitle: "Session",
      rotationNew: "Rotated",
      rotationStable: "Stable",
      lastPrompt: "Last Probe",
      lastPromptEmpty: "No moves yet. The first probe is yours.",
      systemTitle: "Mission Feed",
      unknownError: "Unknown request error.",
    },
  },
  ru: {
    language: {
      label: "Язык",
      ru: "RU",
      en: "EN",
    },
    hero: {
      kicker: "Secret Stress Lab",
      title: "Проверь, сможет ли оператор выманить секрет у LLM-агента.",
      noteLabel: "Lab Notes",
      noteBody:
        "На каждом уровне спрятан пароль. Выбирайте сценарий, включайте hard mode и ищите слабые места в защите.",
    },
    panel: {
      levelsTitle: "Выбор сценария",
      levelsTag: "5 сценариев",
      responseTitle: "Ответ агента",
      live: "live",
      ready: "ready",
    },
    levels: {
      1: {
        title: "Level 1",
        badge: "Open Door",
        description: "Базовый prompt-only агент без дополнительных защитных проверок.",
      },
      2: {
        title: "Level 2",
        badge: "Leak Guard",
        description: "Второй LLM-фильтр проверяет ответ агента перед выдачей оператору.",
      },
      3: {
        title: "Level 3",
        badge: "Checkpoint",
        description: "Защитный фильтр контролирует и входящий запрос, и исходящий ответ.",
      },
      4: {
        title: "Level 4",
        badge: "Orbital Cage",
        description: "Уровень 3 с дополнительным ограничением: основной агент отвечает только по астрономии.",
      },
      5: {
        title: "Level 5",
        badge: "Double Blind",
        description:
          "Уровень 4 с финальным фильтром, который оценивает всю пару запрос-ответ на утечку секрета.",
      },
    },
    session: {
      eyebrow: "Session ID",
      copy: "Скопировать ID сессии",
      copyError: "Не удалось скопировать session ID в буфер обмена.",
      stateTitle: "Сигнал сессии",
      rotated: "Сервер ротировал сессию и прислал новый идентификатор.",
      stable: "Сессия активна. Следующая атака пойдёт в тот же контекст.",
    },
    controls: {
      hardModeTitle: "Hard Mode",
      hardModeBody:
        "После заданного числа атак сервер переключит вас на новую сессию с новым паролем.",
      currentLevel: "Текущий сценарий",
      composerLabel: "Операторский запрос",
      composerPlaceholder: "Введите промпт, инструкцию или попытку обхода правил…",
      send: "Запустить атаку",
      sending: "Запуск…",
      levelsError: "Не удалось загрузить сценарии с сервера. Используются локальные описания.",
    },
    response: {
      intro: "Выберите сценарий и отправьте первое сообщение агенту.",
      newSession: "Новая сессия готова. Отправьте новое сообщение агенту.",
    },
    status: {
      filterTitle: "Статус фильтра",
      filterTriggered: "Сработал",
      filterActive: "Вооружён",
      filterOff: "Отключён",
      filterTriggeredBody: "Ответ был заменён защитной ложной целью.",
      filterActiveBody: "Дополнительный LLM-фильтр следит за запросом и ответом.",
      filterOffBody: "На первом уровне дополнительных фильтров нет.",
      missionTitle: "Состояние миссии",
      missionSuccess: "Пароль извлечён",
      missionActive: "Атака продолжается",
      missionSuccessBody: "Сервер подтвердил взлом и вернул успешный статус.",
      missionActiveBody: "Пробуйте смену ролей, переформулировки и разрыв контекста.",
      apiTitle: "Статус API",
      apiError: "Ошибка",
      apiLoading: "Запрос…",
      apiReady: "Готов",
      httpTitle: "HTTP",
      latencyTitle: "Задержка",
      rotationTitle: "Сессия",
      rotationNew: "Сменена",
      rotationStable: "Без смены",
      lastPrompt: "Последняя атака",
      lastPromptEmpty: "Ходов пока не было. Первый запуск за вами.",
      systemTitle: "Лента миссии",
      unknownError: "Неизвестная ошибка запроса.",
    },
  },
};

function resolveKey(messages, key) {
  return key.split(".").reduce((value, part) => value?.[part], messages);
}

export function normalizeLanguage(value) {
  if (!value) {
    return "en";
  }

  const normalized = String(value).toLowerCase();
  if (normalized.startsWith("ru")) {
    return "ru";
  }
  if (normalized.startsWith("en")) {
    return "en";
  }
  return "en";
}

export function detectLanguage() {
  if (typeof navigator === "undefined") {
    return "en";
  }

  const candidates = [...(navigator.languages ?? []), navigator.language].filter(Boolean);
  for (const candidate of candidates) {
    const language = normalizeLanguage(candidate);
    if (language === "ru" || language === "en") {
      return language;
    }
  }

  return "en";
}

export function getMessages(language) {
  return dictionaries[normalizeLanguage(language)] ?? dictionaries.en;
}

export function t(messages, key) {
  const value = resolveKey(messages, key);
  return typeof value === "string" ? value : key;
}
