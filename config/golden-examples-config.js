/**
 * База золотых примеров для ESM
 * Основано на исследованиях Рассела Херлберта
 */

module.exports = {
  // Паттерны для автоматической оценки
  patterns: {
    positive: [
      // Временные маркеры
      {
        name: 'present_moment',
        regex: /\b(завис|застыл|на полпути|в момент|прямо сейчас|именно тогда|в этот миг)\b/i,
        weight: 15,
        category: 'temporal'
      },
      {
        name: 'specific_time',
        regex: /\b(когда услышал сигнал|в момент бипа|прозвучал звук)\b/i,
        weight: 10,
        category: 'temporal'
      },
      
      // Сенсорные детали
      {
        name: 'visual_details',
        regex: /\b(вижу|видел|смотрю|смотрел|глаза на|взгляд|мигал|светился|цвет)\b/i,
        weight: 20,
        category: 'sensory'
      },
      {
        name: 'auditory_details',
        regex: /\b(слышу|услышал|звук|шум|тишина|голос|щелчок|стук)\b/i,
        weight: 20,
        category: 'sensory'
      },
      {
        name: 'tactile_details',
        regex: /\b(касаюсь|трогаю|холод|тепло|мягк|тверд|гладк|шершав)\b/i,
        weight: 20,
        category: 'sensory'
      },
      
      // Телесные ощущения
      {
        name: 'body_awareness',
        regex: /\b(в груди|в животе|в горле|сердце|дыхание|напряг|расслаб|сжа[тл])\b/i,
        weight: 25,
        category: 'somatic'
      },
      {
        name: 'physical_action',
        regex: /\b(палец|рука|нога|голова|плечи|спина|шея|глаза|рот)\b/i,
        weight: 15,
        category: 'somatic'
      },
      
      // Конкретность
      {
        name: 'specific_objects',
        regex: /\b(экран|клавиш|мышь|телефон|стол|стул|окно|дверь|кнопк)\b/i,
        weight: 15,
        category: 'concrete'
      },
      {
        name: 'specific_words',
        regex: /\b(слово|буква|цифра|строка|абзац|предложение)\b/i,
        weight: 15,
        category: 'concrete'
      },
      
      // Признание пустоты
      {
        name: 'acknowledged_emptiness',
        regex: /\b(пустота|ничего не|тишина в голове|провал|отсутствовал|нет мыслей)\b/i,
        weight: 20,
        category: 'emptiness'
      },
      
      // Прямая речь мыслей
      {
        name: 'direct_thought',
        regex: /["«]([^"»]+)["»]/,
        weight: 10,
        category: 'thought'
      }
    ],
    
    negative: [
      // Обобщения
      {
        name: 'generalization',
        regex: /\b(обычно|всегда|часто|иногда|как правило|в основном|постоянно)\b/i,
        penalty: 30,
        category: 'garbage',
        suggestion: 'Избегайте обобщений. Опишите именно ТОТ момент.'
      },
      
      // Абстракции
      {
        name: 'abstraction',
        regex: /\b(интересно|скучно|нормально|хорошо|плохо|весело|грустно)\b/i,
        penalty: 25,
        category: 'garbage',
        suggestion: 'Слишком абстрактно. ЧТО конкретно происходило?'
      },
      
      // Временные периоды
      {
        name: 'time_period',
        regex: /\b(весь день|всё утро|последнее время|сегодня|вчера|недавно|давно)\b/i,
        penalty: 35,
        category: 'garbage',
        suggestion: 'Вернитесь к МОМЕНТУ сигнала, не к периоду времени.'
      },
      
      // Теоретизирование
      {
        name: 'theorizing',
        regex: /\b(наверное|возможно|думаю что|мне кажется|по-моему|видимо|вероятно)\b/i,
        penalty: 20,
        category: 'garbage',
        suggestion: 'Опиши что БЫЛО, а не что ты думаешь об этом.'
      },
      
      // Избегание
      {
        name: 'avoidance',
        regex: /\b(ничего особенного|как всегда|всё ок|без изменений|то же самое)\b/i,
        penalty: 40,
        category: 'garbage',
        suggestion: 'Попробуй внимательнее. Что-то ВСЕГДА происходит в сознании.'
      },
      
      // Иллюзия внутреннего голоса при чтении
      {
        name: 'reading_voice_illusion',
        regex: /чита.*внутренн.*голос|проговарива.*текст/i,
        penalty: 30,
        category: 'illusion',
        suggestion: 'Исследования показывают: внутренний голос при чтении есть только в 3% случаев!'
      }
    ]
  },
  
  // Примеры для разных контекстов
  examples: {
    work: {
      poor: [
        {
          text: "Работал над проектом",
          explanation: "Слишком общо, нет деталей момента",
          tags: ['too_generic']
        },
        {
          text: "Был занят делами",
          explanation: "Абстрактно, не описан конкретный момент",
          tags: ['abstract']
        },
        {
          text: "Делал свою работу как обычно",
          explanation: "Обобщение + отсутствие специфики",
          tags: ['generalization', 'avoidance']
        }
      ],
      good: [
        {
          text: "Курсор мигал после слова 'бюджет' в Excel",
          explanation: "Конкретный объект + точное местоположение",
          tags: ['specific', 'visual']
        },
        {
          text: "Палец завис над клавишей Enter. Думал нажимать или нет",
          explanation: "Физическое положение + ментальное состояние",
          tags: ['somatic', 'decision_moment']
        },
        {
          text: "Смотрел на красную ошибку в строке 42 кода",
          explanation: "Визуальная деталь + точная локация",
          tags: ['visual', 'specific']
        }
      ],
      excellent: [
        {
          text: "Курсор мигал. В голове звучало 'как же исправить'. Плечи напряглись",
          explanation: "Визуал + внутренняя речь + телесное ощущение",
          tags: ['multimodal', 'high_educational_value']
        },
        {
          text: "Нажал Ctrl+S. Услышал щелчок клавиш. Выдохнул с облегчением",
          explanation: "Действие + звук + физическая реакция",
          tags: ['action_sequence', 'sensory_rich']
        },
        {
          text: "Смотрел на пустую строку в IDE. В голове тишина. Пальцы неподвижны над клавиатурой",
          explanation: "Признание ментальной пустоты + точные детали",
          tags: ['emptiness_acknowledged', 'pristine']
        }
      ]
    },
    
    reading: {
      poor: [
        {
          text: "Читал статью с внутренним голосом",
          explanation: "Классическая иллюзия - 97% чтения без голоса!",
          tags: ['reading_illusion', 'common_mistake'],
          commonMistake: true
        },
        {
          text: "Проговаривал слова про себя",
          explanation: "Типичное заблуждение о процессе чтения",
          tags: ['reading_illusion']
        },
        {
          text: "Читал и понимал текст",
          explanation: "Слишком общо, нет деталей момента",
          tags: ['too_generic']
        }
      ],
      good: [
        {
          text: "Глаза на слове 'революция'. В голове образ толпы с флагами",
          explanation: "Точное слово + визуальный образ вместо голоса",
          tags: ['specific', 'visual', 'fixes_reading_illusion']
        },
        {
          text: "Дочитал абзац. Понимал смысл без слов",
          explanation: "Честное признание отсутствия внутреннего голоса",
          tags: ['unsymbolized_thinking']
        },
        {
          text: "Перечитывал одно предложение третий раз. Не понимал",
          explanation: "Конкретное действие + ментальное состояние",
          tags: ['specific_action', 'honest']
        }
      ],
      excellent: [
        {
          text: "Слово 'океан' - в сознании синева и шум волн. Текст исчез, остался только образ",
          explanation: "Мультисенсорный образ полностью заменил текст",
          tags: ['multisensory', 'high_educational_value']
        },
        {
          text: "Читал '1945'. На долю секунды - лицо деда в военной форме. Глаза увлажнились",
          explanation: "Число → эмоциональный образ → физическая реакция",
          tags: ['emotional', 'embodied', 'pristine']
        }
      ]
    },
    
    emotion: {
      poor: [
        {
          text: "Был злой",
          explanation: "Абстрактный ярлык вместо описания опыта",
          tags: ['abstract_label']
        },
        {
          text: "Чувствовал радость",
          explanation: "Называние эмоции без деталей переживания",
          tags: ['abstract_label']
        },
        {
          text: "Испытывал грусть",
          explanation: "Литературное описание, не моментальный опыт",
          tags: ['literary', 'not_experiential']
        }
      ],
      good: [
        {
          text: "Челюсти сжались. Кулаки тоже",
          explanation: "Конкретные телесные проявления эмоции",
          tags: ['embodied', 'specific']
        },
        {
          text: "Улыбка сама расползлась по лицу",
          explanation: "Непроизвольное физическое проявление",
          tags: ['spontaneous', 'somatic']
        },
        {
          text: "В горле встал ком. Глаза защипало",
          explanation: "Множественные телесные ощущения",
          tags: ['embodied', 'specific_location']
        }
      ],
      excellent: [
        {
          text: "Жар поднялся от живота к лицу. В голове крутилось: 'Да как он смеет!'",
          explanation: "Телесная волна + конкретная мысль",
          tags: ['embodied_emotion', 'thought_content', 'pristine']
        },
        {
          text: "В груди как будто пузырьки шампанского. Хотелось подпрыгнуть",
          explanation: "Метафорическое описание ощущения + импульс к действию",
          tags: ['metaphorical', 'action_tendency']
        },
        {
          text: "Слеза скатилась по щеке. Не заметил, когда началась. Солёный вкус на губах",
          explanation: "Непроизвольная реакция + сенсорная деталь",
          tags: ['spontaneous', 'multisensory', 'pristine']
        }
      ]
    },
    
    eating: {
      poor: [
        {
          text: "Ел обед",
          explanation: "Нет деталей момента",
          tags: ['too_generic']
        },
        {
          text: "Было вкусно",
          explanation: "Оценка вместо описания опыта",
          tags: ['evaluation', 'not_experiential']
        }
      ],
      good: [
        {
          text: "Ложка с супом на полпути ко рту. Вижу пар",
          explanation: "Точное положение + визуальная деталь",
          tags: ['specific_position', 'visual']
        },
        {
          text: "Жевал хлеб. Крошки на языке",
          explanation: "Действие + тактильное ощущение",
          tags: ['action', 'tactile']
        }
      ],
      excellent: [
        {
          text: "Откусил яблоко. Хруст. Кислый сок брызнул на нёбо",
          explanation: "Действие + звук + вкус + локация",
          tags: ['multisensory', 'specific']
        },
        {
          text: "Проглатывал суп. Тепло спускалось по пищеводу в желудок",
          explanation: "Отслеживание ощущения через тело",
          tags: ['somatic_tracking', 'pristine']
        }
      ]
    },
    
    nothing: {
      poor: [
        {
          text: "Ничего особенного",
          explanation: "Избегание наблюдения",
          tags: ['avoidance']
        },
        {
          text: "Как обычно",
          explanation: "Отказ от специфичности",
          tags: ['avoidance', 'generalization']
        }
      ],
      good: [
        {
          text: "Смотрел в стену. Пустота в голове",
          explanation: "Действие + признание ментальной пустоты",
          tags: ['emptiness_acknowledged']
        },
        {
          text: "Тишина. Никаких мыслей",
          explanation: "Честное описание отсутствия",
          tags: ['emptiness_acknowledged']
        }
      ],
      excellent: [
        {
          text: "Смотрел в одну точку. В сознании - как выключенный телевизор. Дыхание автоматическое",
          explanation: "Метафора пустоты + телесная деталь",
          tags: ['metaphorical', 'emptiness_acknowledged', 'pristine']
        },
        {
          text: "Осознал сигнал. До этого - провал. Как будто меня не было",
          explanation: "Честное признание отсутствия осознанности",
          tags: ['meta_awareness', 'pristine']
        }
      ]
    },
    
    general: {
      poor: [
        {
          text: "Всё нормально",
          explanation: "Максимально неинформативно",
          tags: ['uninformative']
        }
      ],
      good: [
        {
          text: "Услышал сигнал. Был удивлён",
          explanation: "Конкретная реакция на сигнал",
          tags: ['signal_awareness']
        }
      ],
      excellent: [
        {
          text: "Бип прервал мысль о завтрашней встрече. Мысль исчезла, осталось только эхо звука",
          explanation: "Точный момент прерывания + последствие",
          tags: ['interruption', 'pristine']
        }
      ]
    }
  },
  
  // Обучающие последовательности
  learningSequences: {
    day1: {
      focus: "Ловим момент",
      examples: ["general.good[0]", "work.good[0]"],
      avoid: ["general.poor[0]", "work.poor[0]"]
    },
    day2: {
      focus: "Добавляем сенсорные детали",
      examples: ["work.excellent[0]", "emotion.good[0]"],
      avoid: ["emotion.poor[0]"]
    },
    day3: {
      focus: "Различаем опыт и мысли об опыте",
      examples: ["reading.excellent[0]", "nothing.excellent[0]"],
      avoid: ["reading.poor[0]"]
    }
  },
  
  // Метаданные для исследований
  metadata: {
    version: "1.0",
    lastUpdated: "2024-01-01",
    sources: [
      "Hurlburt, R. T. (2011). Investigating pristine inner experience",
      "Hurlburt, R. T., & Heavey, C. L. (2006). Exploring inner experience",
      "Heavey, C. L., & Hurlburt, R. T. (2008). The phenomena of inner experience"
    ]
  }
};