# GitHub-репозитории: промпты, скиллы, агенты

**Что такое GitHub.** Это крупнейший сайт, где люди и компании выкладывают открытые проекты: код, инструкции, сборники промптов. **Репозиторий (репо)** — одна такая «папка проекта». Читать можно без регистрации, ничего устанавливать не нужно: открыл ссылку → листаешь файлы → файл `README` на главной обычно объясняет, что внутри.

> **Как читать список:** «★ уровень» — наш ориентир полезности для тебя сейчас: ★★★ — открой на этой неделе, ★★ — когда дойдёшь до темы, ★ — для насмотренности.
>
> Все ссылки проверены 06.11.2026 (репозиторий существует и открыт). Большинство материалов — на английском: открывай страницу в браузере с автопереводом или вставляй текст в ChatGPT/Claude с просьбой «объясни по-русски».

---

## 1. Промптинг — учимся ставить задачи

| Репо | Что это и зачем тебе |
|---|---|
| ★★★ [anthropics/prompt-eng-interactive-tutorial](https://github.com/anthropics/prompt-eng-interactive-tutorial) | Официальный пошаговый курс по промптингу от создателей Claude. 9 глав от простого к сложному: роль, примеры, разметка, борьба с выдумками. |
| ★★ [anthropics/courses](https://github.com/anthropics/courses) | Все обучающие курсы Anthropic в одном месте, включая курс промптинга и работу с инструментами. |
| ★★★ [dair-ai/Prompt-Engineering-Guide](https://github.com/dair-ai/Prompt-Engineering-Guide) | Самый известный справочник по техникам промптинга. Есть сайт promptingguide.ai с русской версией. |
| ★★★ [f/prompts.chat](https://github.com/f/prompts.chat) | Бывший «Awesome ChatGPT Prompts» — огромная библиотека готовых промптов-ролей («действуй как …»). Сайт: prompts.chat. |
| ★★ [openai/openai-cookbook](https://github.com/openai/openai-cookbook) | Официальные рецепты OpenAI, включая гайды по промптингу для новых моделей GPT. Больше для технарей, но гайды по промптам полезны всем. |
| ★★ [google-gemini/cookbook](https://github.com/google-gemini/cookbook) | Официальные примеры и гайды Google по Gemini: промпты, работа с файлами, видео, картинками. |
| ★★ [anthropics/claude-cookbooks](https://github.com/anthropics/claude-cookbooks) | Официальные рецепты Anthropic по Claude: разбор документов, извлечение данных, работа с длинными текстами. |
| ★★ [brexhq/prompt-engineering](https://github.com/brexhq/prompt-engineering) | Понятный практический гайд по промптингу от финтех-компании Brex: как устроены модели и почему промпт работает. |
| ★ [NirDiamant/Prompt_Engineering](https://github.com/NirDiamant/Prompt_Engineering) | 22 техники промптинга с примерами — от базовых до продвинутых. |
| ★ [microsoft/generative-ai-for-beginners](https://github.com/microsoft/generative-ai-for-beginners) | Бесплатный курс Microsoft «Генеративный ИИ для начинающих» — 21 урок, есть переводы на разные языки. |
| ★ [langgptai/awesome-claude-prompts](https://github.com/langgptai/awesome-claude-prompts) | Сборник промптов, заточенных под Claude. |
| ★ [ai-boost/awesome-prompts](https://github.com/ai-boost/awesome-prompts) | Подборка промптов, приёмов и статей про промптинг для моделей и агентов. |

## 2. Скиллы — «навыки» для Claude

**Скилл** — папка с инструкцией (файл `SKILL.md`), которая учит Claude делать конкретную работу по правилам. Как установить — в `skills/README.md`.

| Репо | Что это и зачем тебе |
|---|---|
| ★★★ [anthropics/skills](https://github.com/anthropics/skills) | Официальные скиллы Anthropic: Word (docx), PDF, PowerPoint (pptx), Excel (xlsx), брендбук, создание своих скиллов (skill-creator) и др. Отсюда стоит начинать. |
| ★★ [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) | Скилл karpathy-guidelines: короткие правила, которые делают агента аккуратнее — не усложнять, проверять допущения, делать только нужное. (Ранее был по адресу forrestchang/andrej-karpathy-skills — ссылка переадресует.) |
| ★★ [travisvn/awesome-claude-skills](https://github.com/travisvn/awesome-claude-skills) | Каталог лучших скиллов и материалов о них. |
| ★★ [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills) | Ещё один большой каталог скиллов, много практических — для документов, продаж, маркетинга. |
| ★ [obra/superpowers](https://github.com/obra/superpowers) | Набор скиллов-«методология» для агентов: планирование, проверка, пошаговая работа. Больше для разработки. |
| ★ [Leonxlnx/unlazy](https://github.com/Leonxlnx/unlazy) | Скилл unlazy: заставляет агента доводить большие задачи до конца и проверять результат, а не говорить «готово» раньше времени. |
| ★ [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) | Скилл ponytail: учит агента выбирать самое простое рабочее решение без лишнего. |
| ★ [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | Скилл для дизайна интерфейсов и сайтов: помогает агенту делать аккуратный, «не шаблонный» дизайн. |
| ★ [emilkowalski/skills](https://github.com/emilkowalski/skills) | Скиллы дизайнера Эмиля Ковальски (в т.ч. emil-design-eng): анимации и полировка интерфейсов. |
| ★ [remotion-dev/skills](https://github.com/remotion-dev/skills) | Скиллы для создания видеороликов кодом (Remotion). |

## 3. Агенты, Claude Code и коннекторы (MCP)

**Агент** — ИИ, который сам выполняет шаги: читает файлы, ищет, пишет, отправляет. **MCP (Model Context Protocol)** — «универсальная розетка», через которую агент подключается к сервисам: Google Диск, Notion, почта, календарь. Это темы модулей 3–5.

| Репо | Что это и зачем тебе |
|---|---|
| ★★ [anthropics/claude-code](https://github.com/anthropics/claude-code) | Официальная страница Claude Code — агента от Anthropic, который работает с файлами на компьютере. |
| ★★ [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) | Лучшая подборка всего вокруг Claude Code: примеры CLAUDE.md, команды, скиллы, инструменты. |
| ★ [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) | Официальный каталог плагинов для Claude Code (готовые наборы скиллов и команд). |
| ★★ [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) | Официальные примеры MCP-коннекторов: файлы, поиск, Git и др. |
| ★★ [punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) | Огромный каталог MCP-коннекторов к разным сервисам — посмотреть, к чему можно подключить агента. |
| ★ [wong2/awesome-mcp-servers](https://github.com/wong2/awesome-mcp-servers) | Ещё один каталог MCP-коннекторов, компактнее. |
| ★ [modelcontextprotocol/modelcontextprotocol](https://github.com/modelcontextprotocol/modelcontextprotocol) | Описание самого стандарта MCP и документация. |
| ★★ [agentsmd/agents.md](https://github.com/agentsmd/agents.md) | Открытый формат AGENTS.md — файл с правилами для любых агентов (см. `AGENTS.md-example.md`). |
| ★ [openai/codex](https://github.com/openai/codex) | Агент OpenAI Codex для работы в терминале — аналог Claude Code от OpenAI. |
| ★ [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli) | Агент Gemini CLI от Google — аналог Claude Code на Gemini. |
| ★ [Shubhamsaboo/awesome-llm-apps](https://github.com/Shubhamsaboo/awesome-llm-apps) | 100+ примеров готовых ИИ-агентов и приложений — для идей «что можно автоматизировать». |
| ★ [e2b-dev/awesome-ai-agents](https://github.com/e2b-dev/awesome-ai-agents) | Каталог ИИ-агентов разных компаний — обзор рынка. |

## 4. Насмотренность

| Репо | Что это и зачем тебе |
|---|---|
| ★ [x1xhlol/system-prompts-and-models-of-ai-tools](https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools) | Собранные системные промпты (скрытые инструкции) известных ИИ-продуктов. Полезно увидеть, как профессионалы пишут инструкции: роль, правила, запреты, формат. Это неофициальная коллекция — читай как примеры, а не как документацию. |

---

**Итого:** 35 проверенных репозиториев. С чего начать на этой неделе: курс Anthropic по промптингу → prompts.chat → anthropics/skills.

*Yelumio AI Studio · «Фокус ИИ 1:1» · модуль 1*
