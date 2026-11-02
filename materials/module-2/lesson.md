## Ты режиссёр, а не тот, кто жмёт кнопку

:::lead
Нейросеть для картинок и видео — съёмочная группа без камеры. Она умеет всё, но снимает ровно то, что ты описал. Скажешь «красивая кофейня» — получишь среднюю картинку из стока. Опишешь кадр как режиссёр — получишь кадр, который не отличить от съёмки.
:::

В этом модуле мы работаем на **Higgsfield** (higgsfield.ai) — платформе, где в одном окне собраны десятки моделей для фото, видео и голоса.

Сначала договоримся о вкусе. Четыре правила студии отличают рекламу, которой веришь, от «нейросетки»:

- **Жёсткий фотореализм.** Плёнка (Kodak Portra), живая кожа с порами, реальный свет, зерно. Камера, объектив и диафрагма прописаны в промпте.
- **CGI-look — это брак.** Глянцевый пластик, «рендерная» кожа, парящие предметы, светящиеся голограммы — отправляем в корзину, даже если «вроде красиво».
- **Реальное + необычное.** Не скучная документалка и не фантастика. Сюрреальная идея, но снимок настоящий: худи в степи, где снег падает вверх, а кожа, ткань и свет — как на плёнке.
- **Hero-кадр → референс.** Сначала доводим до идеала один главный кадр, утверждаем его — и все остальные кадры серии генерируем по нему. Так лицо, товар и цвет не «плывут».

:::warn Правило №1: без референса не генерируем
Твой товар, твой логотип, твоё лицо — только по реальному фото. Без картинки модель нарисует похожий, но чужой товар. Фото с телефона при дневном свете — уже отличный референс.
:::

## Формула кадра: 7 слоёв промпта

:::lead
Хороший промпт — это не набор красивых слов, а чертёж кадра. Мы собираем его из семи слоёв, всегда в одном порядке: что в кадре → что происходит → где → какой свет → на что «снято» → какой камерой → какие детали и запреты.
:::

:::diagram formula Формула кадра: каждый слой отвечает на свой вопрос, главное — в начале
:::

Пример: кофейне в Астане нужен пост про новый айс-латте.

1. **Объект** — один конкретный предмет или человек. Не «напиток», а «iced latte in a tall clear glass, 350 ml». Размер в сантиметрах — и модель не раздувает товар.
2. **Действие** — что происходит в кадре. Молоко медленно смешивается с эспрессо, капли конденсата стекают по стеклу.
3. **Сцена** — место, время, 2-3 реальные детали. «Pale marble counter, small coffee shop, 8 am, a paper bag of croissants in the background».
4. **Свет** — самый недооценённый слой. Один главный источник с направлением: «low morning sun from the right». Пиши, откуда он падает и какой он: мягкий или жёсткий, тёплый или холодный.
5. **Стиль** — на что «снято»: плёнка, цифровая камера, телефон, иллюстрация. Для рекламы почти всегда «live-action photograph, shot on 35mm film, Kodak Portra 400, visible grain».
6. **Камера** — объектив, диафрагма, ракурс, крупность. 85mm и f/2.8 — портрет с размытым фоном, 24mm — интерьер, 100mm macro — фактура еды.
7. **Детали и запреты** — фактура (поры кожи, царапины на металле, волокна льна) и строка NEGATIVE: чего в кадре быть не должно.

### Чертёж вместо эпитетов

Слова «красиво», «качественно», «perfect», «cinematic», «advertising» не работают — они тянут модель в сток и пластик. Каждое расплывчатое слово заменяем видимым признаком:

| Было (эпитет) | Стало (чертёж) |
|---|---|
| beautiful lighting | one soft key from the upper left, 5600K, soft contact shadow |
| realistic skin | visible pores, fine peach fuzz, natural unretouched skin |
| nice composition | product in the right third, left 60% empty for text |
| cinematic | 35mm film, Kodak Portra 400, visible grain, 85mm, f/2 |
| several cups | exactly three (3) cups on the table |

:::tip Свет без лишней лампы
Если написать «light from a pendant lamp», модель нарисует лампу в кадре. Когда источник не должен быть виден, описывай только свет: «warm light falls as if from an unseen window» — и добавь в NEGATIVE «lamp, light fixture».
:::

### Текст на картинке

Нейросети путают буквы, особенно кириллицу. Правила: не больше 1-3 слов, слово дословно в кавычках, шрифт признаками и фраза «the only text is "...", nothing else is written anywhere». Модель — **GPT Image 2.5**. Заголовки, цены и призыв накладываем в Canva или CapCut, а в кадре оставляем пустое место. Логотип не генерируем — подаём файлом.

## Higgsfield от А до Я

:::lead
Higgsfield — это не одна нейросеть, а «торговый центр» моделей. Главный навык — понимать, в какой отдел идти: одна модель держит текст, другая — лица, третья — движение. Одной модели на всё не бывает.
:::

### Что где в интерфейсе

- **Image** — картинки: модель, промпт, слот для референсов, формат, разрешение, число вариантов.
- **Video** — видео из текста или из картинки: длительность, формат, разрешение, стартовый и конечный кадр.
- **Audio** — голос: Voiceover (текст в речь), Change Voice (заменить голос в готовом видео), Translate (перевод речи с подгонкой губ), добавление своего голоса.
- **Soul ID и Elements** — сохранённые персонажи, товары и локации, которые потом подставляешь в любые генерации.
- **Marketing Studio** — готовые рекламные сценарии: фото товара, UGC-ролик, баннер, товар можно подать ссылкой на сайт.
- **Cinema Studio** — видео, где жанр, свет и объектив задают кнопками, а не текстом.
- **Инструменты правки** — Inpaint (перерисовать зону), Outpaint (расширить кадр), Relight (переставить свет), Angles (новый ракурс), Skin Enhancer (живая кожа), Upscale (повысить разрешение).

:::warn Настройки, которые сбивают новичков
- **Разрешение.** У части моделей по умолчанию стоит 1K. Для фото ставь 2K явно, 4K — только когда точно нужно (печать, билборд).
- **Формат кадра.** Выбирай сразу: 9:16 — Reels и сторис, 4:5 — лента, 16:9 — сайт и YouTube. Режим «auto» иногда ломает формат.
- **Количество.** Генерируй по 1-2 варианта и правь промпт, а не жми «повторить» двадцать раз.
:::

### Какую модель когда

:::diagram models Карта моделей Higgsfield: задача слева, модель справа (на осень 2026)
:::

| Задача | Основная модель | Запасной вариант |
|---|---|---|
| Товар с этикеткой, упаковка, кириллица | GPT Image 2.5 (качество high, 2K) | Ideogram 4.5 для постеров |
| Сложная сцена, смена фона с сохранением позы | Nano Banana Pro | Nano Banana 2 |
| Много черновиков, поиск идеи | Seedream 5.0 Pro | Nano Banana 2 |
| Кинокадр, локация, кастинг героя | Soul Cinema | Soul 2.0 |
| Один и тот же реальный человек в серии | Soul ID + Soul 2.0 | лист персонажа + референс |
| Оживить фото товара, держать кадр 1:1 | Kling 3.0 | Seedance 2.5 |
| Люди крупно, сцена 10-30 секунд, диалог | Seedance 2.5 | Veo 3.1 |
| Короткий фотореальный план, природа, погода | Veo 3.1 | Seedance 2.5 |
| Закадровый голос на русском или английском | Higgsfield Audio (Voiceover) | ElevenLabs |
| Голос на казахском | ElevenLabs v4 | — |

:::tip Связка, как у профи
Черновики делаем быстрыми моделями (Seedream, Soul Cinema), лучший вариант доводим в Nano Banana Pro или GPT Image 2.5, а мелочи чиним инструментами. Если кадр почти хороший — не перегенерируй, а правь в таком порядке: ракурс → свет → цвет → кожа → разрешение → один дефект через Inpaint → формат через Outpaint.
:::

## Видео: из идеи и из фото

:::lead
Есть два пути к видео. Text-to-video — описываешь сцену словами, и модель снимает её с нуля. Image-to-video — даёшь готовый кадр, и он оживает. Для бизнеса основной путь второй: сначала утверждаем идеальное фото, потом добавляем движение. Так ты контролируешь товар, свет и композицию.
:::

### Image-to-video: оживляем кадр

Главное правило: **модель уже видит фото — не описывай его заново.** Пиши только, что двигается и как движется камера. Утверждённый кадр — это замок: упаковка, логотип, фон, тени и реквизит остаются как были, двигается только то, что ты назвал.

Формула короткая: **одно движение в сцене + одно движение камеры + что остаётся неподвижным + NEGATIVE.** Например, для кофейни: молоко медленно смешивается с эспрессо, камера стоит, стакан, лого и тени заморожены, пара нет.

:::warn Пар превращает кофейню в спа
Модели обожают дорисовывать пар, дым и туман. Для напитков пиши запрет всегда, даже для горячих: «no steam, vapour, smoke, haze, mist». Для холодных — «ICE-COLD drink: the air stays completely clear».
:::

**Start и end frame.** Если загрузить и первый, и последний кадр, модель достроит путь между ними. Это лучший способ сделать точный переход: закрытая коробка → открытая коробка, пустая тарелка → тарелка с блюдом. Только не проси действие, которое на стартовом кадре уже случилось.

### Text-to-video: сцена из идеи

Здесь промпт — режиссёрский сценарий в порядке: стиль → сцена одной фразой → первый кадр → план с секундами → свет → «замки» → звук (образец — промпт 13 в библиотеке). В одной генерации 1-3 действия; не влезает — делим на клипы.

### Движения камеры

Правило нашего курса: **одно движение + запрет соседних.** Иначе модель путает зум с наездом, а облёт — с вращением товара.

| Движение | Как писать (EN) | Когда брать |
|---|---|---|
| Статика | static locked-off camera, no movement | движется сам товар или жидкость |
| Медленный наезд | slow push-in toward the cup, no zoom | акцент на товаре, эмоция |
| Облёт | slow arc around the product, no turntable effect | показать товар с разных сторон |
| Панорама | pan right from one fixed point | раскрыть пространство кофейни |
| Наклон | tilt up from shoes to face | образ целиком, одежда |
| Перевод фокуса | rack focus from background to product | переключить внимание на товар |
| Ручная камера | handheld, subtle 1-2 cm shake | UGC, «живое» видео от лица клиента |

Добавляй числа — «about 30 cm of travel», «1.5 m radius» — и «settle and hold» в конце, чтобы кадр не обрывался на движении.

### Как принимать дубль

- **Смотри клип до конца.** Брак прячется на 5-8 секунде: товар меняет форму, лого плывёт.
- **4 плохих дубля из 4 — проблема в промпте**, а не в удаче. Меняй одну строку.
- **Черновик, потом финал.** Пробуй движение в 720p без звука, а финальную версию делай в 1080p.

:::tip Kling или Seedance
Kling 3.0 отлично держит стартовый кадр 1:1 — бери его для товара, еды, напитков и общих планов. Лица крупным планом Kling иногда ломает, поэтому людей крупно оживляем в Seedance 2.5.
:::

## Консистентность: один герой и один товар во всех кадрах

:::lead
Одна красивая картинка — ещё не контент. Бренду нужна серия: тот же бариста, та же худи, тот же стакан в десяти постах и трёх роликах.
:::

### Референсы с ролями

Когда грузишь несколько картинок, подпиши роль каждой прямо в промпте: «Image 1 is the product: keep bottle shape, label and colour exactly. Image 2 is a light and mood reference only, ignore its subject.» Одежда с референса перебивает текст — нужна другая, пиши «ignore clothing in the reference».

### Лист персонажа

Для повторяющегося героя (маскот, «лицо» кофейни, бариста) делаем лист персонажа — одну картинку с 2-3 видами героя:

- в полный рост спереди (со стопами), в полный рост сзади, крупно голова и плечи;
- фон однотонный средне-серый, **не белый** — на белом пересвет и не видно брака;
- свет мягкий, почти без теней, 5600K, с бликами в глазах;
- приметы со стороной: «small scar through the LEFT eyebrow»;
- **одно лицо на лист:** лицо видно только на крупном плане, на панелях в рост его стирают, иначе видео «прыгает» между двумя версиями лица.

Лист сохраняешь как Element с понятным именем — и подставляешь его в каждую генерацию через @тег.

### Soul ID: твоё лицо в любом кадре

Если герой — реальный человек (ты, врач клиники, шеф ресторана), обучаем **Soul ID**. Нужно 20+ свежих фото одного человека при одном свете: анфас, 3/4, профиль, одно в полный рост, разные выражения. Нельзя: очки, фильтры, глубокие тени, групповые фото, селфи с вытянутой руки. Дальше лицо работает в Soul 2.0, Soul Cinema и через Elements — в видео.

:::warn Чужое лицо — только с согласия
Soul ID и клон голоса делаем только на себе или на человеке, который письменно согласился. Сотрудник уволился — его цифровой двойник из рекламы тоже уходит.
:::

### Товар и стиль серии

- **Товар** — лист из реального фото: «Make a product sheet with front, back and top shot for the product from Image 1». Не генерируй товар с нуля.
- **Единый стиль-блок.** Абзац про свет, цвет и плёнку копируй дословно во все промпты серии. Меняется только объект и действие.
- **Модель не меняй посреди серии** — у каждой своя «рука».
- **Лицо не меньше 20% кадра.** На мелком лице модель теряет сходство.

## Голос, звук и сборка ролика

:::lead
Половину впечатления от ролика делает звук. Дорогое видео с плохим голосом выглядит дёшево, а простой кадр с хорошей озвучкой — как реклама с ТВ.
:::

:::diagram pipeline Путь от фото к готовому ролику: каждый шаг проверяешь отдельно
:::

### Три слоя звука

1. **Звук сцены.** Seedance 2.5 генерирует его сам: шипение кофемашины, звон чашки, шум улицы. Музыку внутри генерации выключаем: «No music».
2. **Закадровый голос.** Higgsfield Audio → Voiceover: текст, голос из пресетов или свой (запись до 2 минут), скачать файл. Для казахского берём ElevenLabs v4 и даём текст на вычитку носителю.
3. **Музыка.** В Higgsfield её нет — берём библиотеку CapCut или Suno. Музыка всегда тише голоса.

### Текст «для уха»

Короткие фразы, одна мысль — одно предложение, цифры словами, без скобок и сокращений. Темп: **15 секунд ≈ 30-35 слов**, на 10-секундный ролик — 2-3 фразы.

:::example 15 секунд для кофейни
«Утро в Астане начинается с холода. А заканчивается — здесь. Новый айс-латте на овсяном молоке. Сладость без сахара, бодрость без спешки. Заходи до десяти — второй стакан в подарок.»
Пять фраз, 30 слов, в конце призыв, цифры словами.
:::

### Говорящий герой и губы

Если персонаж должен говорить в кадре, сначала делаем голос, потом видео: стартовый кадр с сомкнутыми губами, камера стоит, клип короче 30 секунд. Готовую дорожку подаём в Seedance 2.5 как аудио-референс — губы двигаются под твой текст. Переписали реплику после съёмки — губы подгоняют в Lipsync Studio. Двух говорящих в одном кадре снимай по очереди.

### Сборка в CapCut

Порядок дорожек: видео → голос → звук сцены → музыка (тише всех) → титры. Титры держи в кадре не меньше 2 секунд. Экспорт в формате площадки: 9:16, 4:5 или 16:9.

## Практика на созвоне

:::steps
1. Бриф — выбираем твой товар или услугу, формат (Reels 9:16 или лента 4:5) и снимаем товар на телефон у окна.
2. Формула — вместе раскладываем идею кадра по 7 слоям и пишем первый промпт на английском.
3. Товарное фото — генерируем в GPT Image 2.5 или Nano Banana Pro с твоим фото как референсом, 2K, по 1-2 варианта.
4. Три итерации — меняем по одной вещи: сначала свет, потом композицию, потом фактуру. Утверждаем hero-кадр.
5. Персонаж — генерируем героя для бренда (бариста, мастер, врач) и собираем его лист персонажа на сером фоне.
6. Герой с товаром — ставим героя и товар в одну сцену по двум референсам с подписанными ролями.
7. Оживляем — hero-кадр в Kling 3.0 (товар) или Seedance 2.5 (человек крупно): одно движение, одна камера, 5 секунд, черновик.
8. Разбор дубля — смотрим до конца, проверяем лого и форму, правим одну строку, делаем финал в 1080p.
9. Озвучка — пишем текст для уха на 10-15 секунд, генерируем голос в Higgsfield Audio, выбираем из 2-3 голосов.
10. Сборка — видео, голос и музыка в CapCut; все промпты — в личную библиотеку.
:::

## Промпт-библиотека

Промпты на английском — модели понимают его точнее. В [скобках] подставляй своё; референс из слота картинок называется Image 1.

**1. Товар-герой.** Студийное фото товара по референсу, этикетка не перерисовывается. GPT Image 2.5.

:::prompt Товар-герой (packshot)
Live-action studio product photograph, 4:5. NOT a 3D render. Image 1 is the product: keep the bottle shape, label layout and colours exactly as in Image 1, do not redraw the label. A [250 ml amber glass bottle of hair oil] stands on [a rough travertine block]. Medium close-up, product in the right third, fully in frame with 10% margin. Full-frame camera, 90mm macro lens, f/5.6, focus on the label. One soft key from the upper left, 5600K, soft contact shadow on the stone. Plain [warm sand] wall behind. Real glass reflections. No text except the original label.
NEGATIVE: CGI gloss, plastic look, floating product, warped letters, duplicated objects.
:::

**2. Одежда в жизни.** Твоя вещь на модели в городе, плёночная фактура. Nano Banana Pro.

:::prompt Одежда на улице
Candid street fashion photograph, 4:5, shot on 35mm film, Kodak Portra 400, visible grain. Image 1 is the garment: keep its cut, colour and print exactly; ignore the pose and background in the reference. A [young woman in her 20s] wearing the [oversized cream hoodie] from Image 1 walks across [a snowy city square at dusk], hands in the front pocket. Medium shot, eye level, 50mm, f/2. Cold blue dusk ambient plus warm light falling from shop windows as if from an unseen source. Real skin with pores, slush on the pavement.
NEGATIVE: plastic skin, airbrushing, CGI, extra fingers, logos, text.
:::

**3. Портрет эксперта.** Для клиники, салона, личного бренда — без «бьюти-фильтра».

:::prompt Портрет эксперта
Editorial portrait photograph, 4:5, medium format film look, fine grain. A [dentist in her 40s] in [a white linen coat] stands by the window of [a bright minimal clinic], arms relaxed, calm half-smile, looking just past the camera. Medium close-up, face fills about a third of the frame, 85mm, f/2.2, focus on the eyes. One soft window key from the left, 5000K, gentle falloff into shadow on the right cheek, catchlights in the eyes. Visible pores, fine peach fuzz, natural unretouched skin.
NEGATIVE: plastic skin, beauty filter, airbrushing, CGI, stock photo smile, extra fingers.
:::

**4. Блюдо сверху.** Фото для меню и доставки, рука в кадре для жизни.

:::prompt Еда (вид сверху)
Overhead food photograph, 4:5, natural film look with soft grain. [A plate of beshbarmak with thin hand-cut noodles, tender lamb and onion sauce] on [a dark walnut table], [a bowl of broth and a small dish of baursaks] beside it, a hand reaching in from the lower right with a fork. Top-down 90-degree angle, 50mm, everything sharp. One soft daylight key from the top left, 5200K, real contact shadows under the plates. Glistening sauce, flour dust on the noodles.
NEGATIVE: plastic food, CGI, oversaturated colours, steam, extra fingers, text, logos.
:::

**5. Напиток с логотипом.** Стакан с твоим лого, конденсат, утренний свет.

:::prompt Напиток в кофейне
Close-up drink photograph, 4:5, shot on 35mm film, Kodak Portra 400, grain. Image 1 is our cup: keep the cup shape and printed logo exactly. An [iced latte] in the cup from Image 1 stands on [a pale marble counter of a small coffee shop], condensation droplets on the cup, milk marbling into the espresso. Medium close-up, 85mm, f/2.8, cup in the left third, the cafe softly blurred behind. Low morning sunlight from the right as if from an unseen window, long soft shadow on the counter.
NEGATIVE: steam, vapour, CGI gloss, distorted logo, extra cups, text.
:::

**6. Интерьер.** Локация для сайта и референс для будущих видео.

:::prompt Интерьер
Architectural interior photograph, 3:2, live-action. [A small Scandinavian-style coffee shop] shot from a 3/4 angle so two walls are visible and the space reads with depth. Light oak tables about 1.5 m apart, green plants, a brushed brass counter. 24mm, eye level at 1.5 m, vertical lines kept straight. Late afternoon sun through large windows on the left, warm light patches on the concrete floor. Real wood grain and matte ceramic. No people, no text.
NEGATIVE: CGI render look, fisheye distortion, people, signage, text.
:::

**7. Баннер.** Левая часть пустая — под заголовок в Canva.

:::prompt Баннер под заголовок
Editorial still life photograph, 16:9, live-action. [A bouquet of white peonies wrapped in kraft paper] lies on [a pale linen tablecloth] in the right third of the frame. The left 60% is plain empty background reserved for headline text. One hard late-morning sun key from the right, crisp leaf shadows across the cloth, 5600K. 70mm, f/4, slightly high angle. Palette: cream, soft green, one accent of [dusty pink]. ABSOLUTELY NO TEXT, no letters, no logos anywhere.
NEGATIVE: objects in the empty area, CGI, oversaturated colours, watermark.
:::

**8. Слово в кадре.** Вывеска в 1-3 слова. GPT Image 2.5.

:::prompt Вывеска с текстом
Live-action photograph, 4:5, 35mm film grain. [A small bakery storefront] at dusk in winter. Above the door hangs a wooden sign; the only text is "[NAN]" in hand-painted cream serif capital letters, centred on the sign, nothing else is written anywhere. Warm light spills from the shop window onto the snowy pavement. Eye level, 35mm, f/2.8.
NEGATIVE: extra words, misspelled letters, random signs, watermark, CGI.
:::

**9. Лист персонажа.** Герой в трёх видах — потом сохраняешь как Element.

:::prompt Лист персонажа
Character reference sheet, three panels side by side on a flat medium-grey background (#808080, never white), thin dividers. Panel 1: full body front view, feet visible. Panel 2: full body back view. Panel 3: head-and-shoulders close-up. The face is visible only in panel 3; erase the face from the full-body panels. Character: [a 30-year-old barista, 175 cm, short dark hair, small scar through the LEFT eyebrow, olive linen apron over a white T-shirt, black jeans]. Neutral soft even wrap-around light, near-shadowless, 5600K, eye catchlights. One identical person in all panels.
NEGATIVE: text, gradient, vignette, cast shadows, second person.
:::

**10. Товар: едет только камера.** Image-to-video в Kling 3.0.

:::prompt Товар: медленный наезд
The whole scene is a frozen still photograph. The ONLY motion is the camera: an extremely slow, smooth, steady push-in toward the [bottle], about 30 cm over the clip, then settle and hold. No zoom, no pan, no tilt, no handheld drift. The product, its label, the background colour, every prop and all shadows stay exactly as in the first frame; the label stays sharp and readable.
NEGATIVE: label change, new objects, background colour change, shadow change, fast motion.
:::

**11. Напиток: движется только жидкость.** Камера стоит, пара нет.

:::prompt Напиток: живая жидкость
Static locked-off camera: no zoom, no pan. Milk keeps slowly marbling down into the iced espresso exactly as started in the first frame; tiny condensation droplets slide down the cup. The cup, its logo, the ice cubes, the counter and every prop stay perfectly still. Calm, slow, realistic liquid physics. ICE-COLD drink: the air stays completely clear.
NEGATIVE: steam, vapour, smoke, mist, hands, straws, new objects, camera movement, logo distortion.
:::

**12. Живой портрет.** Seedance 2.5: человек дышит, смотрит в камеру, лицо не меняется.

:::prompt Портрет: живой взгляд
One continuous take, no cuts. Slow dolly in at eye level from medium shot to medium close-up, about 50 cm of travel, then settle and hold; no zoom, no pan, no handheld drift. The [doctor] breathes calmly, glances down at [the tablet in her hands], then lifts her eyes to the lens and her half-smile slowly widens. Hair and coat move only slightly. Face, identity and clothing stay 100% as in the first frame. Lips stay closed. Real unretouched skin.
AUDIO: quiet clinic room tone only. No music.
:::

**13. Сцена из идеи.** Text-to-video в Seedance 2.5, режиссёрская структура.

:::prompt Рекламная сцена (text-to-video)
GLOBAL STYLE: photoreal live-action, warm documentary look, 35mm film grain, 24fps, 9:16. No 3D render look, real unretouched skin.
SCENE: a barista makes the first cappuccino of the morning in [a small coffee shop]. 8 seconds, one single continuous take, no cuts.
FIRST FRAME: extreme close-up of a metal pitcher pouring milk into a white cup.
SHOT (0-8s): 100mm macro, a latte-art heart forms (0-4s); the camera slowly pulls back about 1 m to a medium shot as the barista slides the cup across the counter (4-8s). No zoom, no pan.
LIGHTING: low morning sun from the window behind the camera, 4500K.
POSITIVE LOCKS: exactly one person, exactly one cup.
AUDIO: espresso machine hiss, milk pour, cup on saucer. No music.
:::

## Частые ошибки

| Симптом | Что делать |
|---|---|
| Кожа как пластик | поры, пушок, зерно явно; один чёткий свет; убрать perfect, cinematic; «no CGI» |
| Товар «похож, но не мой» | загрузить реальное фото как Image 1 и написать, что сохранить: форма, этикетка, цвет |
| Буквы и лого — каша | GPT Image 2.5, 1-3 слова в кавычках; лого файлом; длинный текст — в Canva |
| Лицо меняется от кадра к кадру | лист персонажа или Soul ID; лицо не меньше 20% кадра; одна модель на серию |
| Пишешь «not smiling» — он улыбается | писать позитивом, что должно быть: «calm neutral face, lips closed» |
| Камера мешает движения | одно движение + запрет соседних: «slow push-in, no zoom, no pan, no tilt» |
| В кадре лишняя лампа или два солнца | один источник света; невидимый источник — без слова-предмета, «as if from an unseen window» |
| Лишние пальцы | написать, где каждая рука и что держит; меньше рук в кадре |
| Видео перегружено и «несётся» | 1-3 действия на клип; длинную историю делить на клипы и склеивать |
| 4 плохих дубля подряд | проблема в промпте, а не в удаче: переписать одну конкретную строку |

## Чек-лист: готово, если

- Товар и лица — по реальному фото, роль каждого референса подписана.
- Промпт разложен по формуле: объект, действие, сцена, свет, стиль, камера, детали + NEGATIVE.
- Формат кадра совпадает с площадкой, фото в 2K, видео-финал в 1080p.
- Кожа живая, без пластика и «рендера»; лишних пальцев, предметов и букв нет.
- Лого, этикетка и цвет товара совпадают с оригиналом на каждом кадре.
- В видео одно понятное движение и одно движение камеры, клип просмотрен до последней секунды.
- Голос звучит естественно, музыка тише голоса, титры держатся от 2 секунд.
- Все удачные промпты сохранены в личной библиотеке вместе с тем, что меняли между итерациями.

## Глоссарий

| Термин | Что это простыми словами |
|---|---|
| Промпт | текстовое описание кадра или ролика для нейросети |
| Модель | конкретная нейросеть внутри Higgsfield (GPT Image 2.5, Kling 3.0, Seedance 2.5) |
| Референс | картинка-образец: товар, лицо, стиль или свет, которые модель должна повторить |
| Hero-кадр | главный утверждённый кадр серии, по которому делаются остальные |
| NEGATIVE | строка в конце промпта: чего в кадре быть не должно |
| Text-to-video | видео из текстового описания сцены |
| Image-to-video | видео из готовой картинки: кадр оживает |
| Start / end frame | первый и последний кадр, между которыми модель строит движение |
| Лист персонажа | картинка с героем в 2-3 видах на сером фоне для консистентности |
| Soul ID | обученная модель лица реального человека по 20+ фото |
| Element | сохранённый персонаж, товар или локация, подставляется через @тег |
| Inpaint / Outpaint | перерисовать выбранную зону / расширить кадр за края |
| Voiceover | закадровый голос из текста |
| Липсинк | подгонка движения губ под звук |
| Aspect ratio | формат кадра: 9:16, 4:5, 1:1, 16:9 |

## Полезные ссылки

- [Higgsfield — генерация фото, видео и голоса](https://higgsfield.ai)
- [ElevenLabs — голос и озвучка, в том числе на казахском](https://elevenlabs.io)
- [CapCut — монтаж, музыка и титры](https://www.capcut.com)
- [Canva — заголовки и текст поверх визуалов](https://www.canva.com)
- [Suno — музыка для роликов](https://suno.com)

> Модели и интерфейс Higgsfield обновляются каждые пару месяцев. Формула кадра, работа с референсами и правило «одна правка за раз» остаются — на них и держится результат.
