# Визуальные стили модулей

Общий каркас — «Лаванда» (`frontend/css/brand.css`): шрифты Unbounded / Golos Text / IBM Plex Mono, сетка, радиусы, компоненты.
Каждый из 5 модулей поверх него получает свою палитру, фактуру и язык картинок, чтобы блок узнавался с первого взгляда:
карточка на маршруте, пункт боковой панели, страница модуля, плеер (фон, прогресс, кнопки, обложки глав) и SVG-схемы.

## Как устроено
- `data-mod="N"` ставит `app.js` на карточку маршрута (`.route-step`), пункт боковой панели, карточку «Сейчас»,
  `#moduleDetailView`; `deck.js` — на корень плеера (`DECK.open({ mod })`).
- `frontend/css/modules.css` для `[data-mod="N"]` переопределяет фирменные токены: `--violet`, `--violet-ink`, `--lavender`,
  `--deep`, `--end`, их `*-rgb`, `--tint`, `--tint-strong`, `--dusk`, `--cursor` + свои `--mod-glow` (второй акцент)
  и `--mod-bg` (фактура). Компоненты не дублируются: они и так берут `var(--violet)` и т.д., внутри модуля — цвет модуля.
- Прозрачности фирменных цветов в CSS пишем только через токены: `rgba(var(--violet-rgb), .2)`, не `rgba(139, 92, 246, .2)`.
- Фактура `--mod-bg` ложится поверх `--dusk` на шапке модуля, обложках глав, пустых превью и полосе карточки маршрута.
- SVG-схемы рисуем в цветах «Лаванды» (`docs/LESSON_FORMAT.md`); внутри модуля `#8B5CF6 / #5B33C9 / #D2C2FF / #24124A`
  в `fill`/`stroke`/`stop-color` автоматически меняются на `--violet / --violet-ink / --lavender / --deep`. Персик `#FFB59A`, чернила и бумага — общие.
- Обложка модуля для карточки маршрута — поле `card` в `materials/module-N/meta.json` (файл из `frontend/media/module-N/`).
- Новый модуль: блок `[data-mod="6"] { … }` в `modules.css` (все токены из списка выше), стиль картинок — раздел ниже.

## Палитры

| Модуль | Стиль | --violet (кнопки, акцент) | --violet-ink (текст на бумаге) | --lavender (светлый) | --deep / --end (тёмный) | --mod-glow | Фактура --mod-bg |
|---|---|---|---|---|---|---|---|
| 1 · Все LLM | «Ультрамарин» — риограф | #3B5BFF | #2538C4 | #C8D3FF | #0F1A55 / #060B26 | #FFB59A персик | полутоновые точки 9 px |
| 2 · Higgsfield | «Кинокадр» | #E5243F кармин | #B4142E | #FFC3CB | #3A0714 / #12030A | #FFB547 янтарь | перфорация плёнки сверху/снизу + засветка |
| 3 · Claude | «Бумага и глина» | #C2603C терракота | #9A4526 | #F4D3C0 | #3A1E12 / #1A0D07 | #E9B48F | волокна бумаги (SVG-шум) |
| 4 · Агент на Ductor | «Чертёж» | #0E8F86 бирюза | #0A6B64 | #AEEDE5 | #062E33 / #021417 | #5EEAD4 | сетка синьки 28/7 px |
| 5 · Агенты advanced | «Система» | #4E8A0E | #3F6F09 | #D6F59C | #152308 / #080D03 | #B8F03A лайм | сеть узлов: точки 28 px + диагонали |

Контраст: белый текст на `--violet` ≥ 4:1, `--violet-ink` на `--paper2` ≥ 5.5:1, `--deep` на `--lavender` ≥ 10:1 (как у базовой «Лаванды»).

## Картинки
Обложки глав — 1080×1350 (4:5) `.webp` ≤ 250 КБ, нижняя треть — спокойная тёмная зона под текст обложки. Без текста и логотипов.
Генерация — Higgsfield, **одна генерация на слот**; явный брак — максимум одна повторная. Модель и промпт каждой картинки —
в `frontend/media/module-N/prompts.json`: `{ "файл.webp": { "model": "…", "prompt": "…" } }`.
Шаблон: `<стиль модуля> + Subject: <метафора главы, 1-2 предложения> + <композиция и запреты>`.

### 1 · «Ультрамарин» — Nano Banana 2 (`nano_banana_2`)
Риограф в две краски (ультрамарин + коралл-персик) на тёплой бумаге, полутон, лёгкое несовмещение, плоские формы, метафоры:
домино-токены, стол под лампой, три персонажа-ассистента.
```
Risograph print editorial illustration in two inks only: ultramarine blue and soft coral-peach, printed on warm off-white recycled paper. Visible halftone dot texture, slight ink misregistration, flat bold geometric shapes, clean generous negative space, smart and playful like a modern science magazine cover. Subject: <…>. Composition 4:5 vertical: the illustration lives in the upper two thirds; the lower third is one calm, uniform, solid field of deep ultramarine ink for overlaid text. No text, no letters, no numbers, no logos, no watermark, no readable screens.
```

### 2 · «Кинокадр» — Nano Banana Pro (`nano_banana_pro`)
Кадр из фильма: анаморф, кармин и янтарь против сине-зелёных теней, дымка, блик, зерно Vision3 500T, живая кожа.
```
Cinematic film still from a modern feature film, shot on an anamorphic lens, shallow depth of field. Subject: <…>. Lighting: bold crimson and warm amber practical lights cutting through deep teal-black shadows, light atmospheric haze, a subtle horizontal anamorphic lens flare. Colour grading: rich, high contrast, crimson and amber against teal. Kodak Vision3 500T film grain, real skin texture, honest photographic realism, no CGI look. Composition 4:5 vertical: the subject in the upper two thirds; the lower third falls into calm, uniform deep shadow for overlaid text. No text, no letters, no numbers, no logos, no watermark, no readable screens.
```

### 3 · «Бумага и глина» — Seedream 5.0 Pro (`seedream_v5_pro`, 3:4 → кроп 4:5)
Диорама из резаной бумаги, крафт-картона и терракотовой глины при дневном свете, волокна, рваные края — тёплое, ручное.
```
Handmade paper-craft diorama photographed in soft natural window daylight: layered cut paper, kraft cardboard, cream cotton paper and small terracotta clay pieces, visible paper fibers, torn and cut edges, tiny soft shadows between the layers, warm, tactile and calm, like a stop-motion film set. Palette: terracotta, cream, sand, kraft brown with one small touch of sage green. Subject: <…>. Composition vertical: the diorama in the upper two thirds; the lower third is a calm, uniform dark-brown kraft-paper surface in soft shadow for overlaid text. No text, no letters, no numbers, no logos, no watermark, no readable screens.
```

### 4 · «Чертёж» — Nano Banana Pro (`nano_banana_pro`)
Синька: белые и аква-линии на тёмно-бирюзовой бумаге, изометрический разрез, размерные стрелки, пустые выноски — агент как механизм.
```
Technical blueprint drawing: crisp white and pale aqua linework on deep teal-navy blueprint paper, precise isometric cutaway illustration, thin construction lines, dimension arrows, small empty circle callout markers, a faint engineering grid and subtle paper texture, like a beautiful engineer's patent drawing. Subject: <…>. All callout circles and label boxes stay empty. Composition 4:5 vertical: the drawing in the upper two thirds; the lower third of the sheet is calm, plain, dark blueprint paper for overlaid text. No text, no letters, no numbers, no logos, no watermark, no readable screens.
```

### 5 · «Система» — Nano Banana 2 (`nano_banana_2`)
Тёмный изометрический мини-мир из стеклянных и графитовых модулей, связанных лаймовыми световыми дорожками, макро-глубина резкости.
```
Intricate dark isometric miniature world, photographed like macro product photography with shallow depth of field: interconnected modules of frosted glass and matte graphite on a black surface, thin glowing acid-lime light paths flowing between them like circuits, many tiny precise details, volumetric light, complex but orderly, like a living data-center city. Palette: black, graphite, frosted glass, acid lime glow, small cool white highlights. Subject: <…>. Composition 4:5 vertical: the system in the upper two thirds; the lower third is a calm, uniform, dark matte surface for overlaid text. No text, no letters, no numbers, no logos, no watermark, no readable screens.
```

Иллюстрации внутри урока (gen-*.webp в модулях 1–2) показывают результат конкретного учебного промпта — их стиль задаёт сам промпт, а не стиль модуля.
Примеры с Higgsfield (`ex-*.webp`, глава `examples` модуля 2, слайды `gallery`) — чужие публичные работы из открытой ленты Higgsfield:
не генерируем, стиль модуля к ним не применяем; в `prompts.json` — модель и промпт автора как есть, в слайде — `source` на оригинал.
Обложка этой главы (`cover-examples.webp`) — обычная обложка в стиле «Кинокадр».
