# Модуль 2 — Генерация изображений и видео

Учимся делать картинки, видео и озвучку для бизнеса на одной платформе — Higgsfield. Цель модуля: ты уходишь с созвона с первыми готовыми визуалами и формулой, по которой можно повторять результат.

## Ключевые понятия

- **Higgsfield** — онлайн-платформа (higgsfield.ai), где в одном месте собраны разные нейросети для картинок, видео и голоса. Не нужно регистрироваться в десяти сервисах.
- **Модель** — конкретная нейросеть внутри платформы. У каждой свои сильные стороны: одна лучше рисует людей, другая — текст на картинке, третья — движение. Модели постоянно обновляются, поэтому какую выбрать — подскажу на созвоне.
- **Промпт** — текстовое описание того, что ты хочешь получить. Для генерации картинок и видео пиши его на английском: модели понимают его точнее.
- **Формула кадра** — объект + сцена + свет + стиль. Плюс по желанию: камера/объектив, композиция, детали. Это каркас любого хорошего промпта.
- **Text-to-video** — видео из текста: описываешь сцену словами, получаешь ролик.
- **Image-to-video** — видео из фото: загружаешь готовую картинку и описываешь, как она должна ожить. Описывай движение и камеру, а не саму картинку заново.
- **Референс** — изображение-образец, которое ты загружаешь, чтобы модель повторила стиль, лицо, товар или композицию.
- **Синтез речи (озвучка)** — генерация голоса из текста, чтобы наложить его на видео: закадровый голос для рекламы, рилса, презентации.

## Пошагово

1. Зайди на higgsfield.ai и зарегистрируйся (через Google или почту).
2. Посмотри, какие разделы есть: изображения, видео, аудио. Тарифы и стоимость генераций смотри на самом сайте — они меняются.
3. Открой генерацию изображений и выбери модель, которую мы обсудили на созвоне.
4. Напиши первый промпт по формуле: объект + сцена + свет + стиль. Начни с простого — например, свой товар на нейтральном фоне.
5. Выбери формат кадра под задачу: вертикальный 9:16 для сторис и рилс, 4:5 для ленты, 16:9 для сайта и YouTube.
6. Сгенерируй 2-4 варианта и выбери лучший. Не правь всё сразу — меняй одну деталь за раз (свет, фон, ракурс).
7. Если нужен твой реальный товар или лицо — загрузи фото как референс.
8. Перейди в раздел видео, выбери image-to-video и загрузи лучшую картинку. Опиши только движение и камеру.
9. Для ролика с нуля попробуй text-to-video: опиши сцену, действие и движение камеры.
10. Сделай озвучку: вставь текст закадрового голоса, выбери голос, скачай аудио и наложи на видео в любом монтажном приложении (например, CapCut).
11. Сохрани удачные промпты в заметки — это твоя личная библиотека, к ней будешь возвращаться.

## Готовые промпты

Подставляй свои детали вместо слов в [квадратных скобках].

**Предметная съёмка товара**

```
Premium product photo of a [matte black ceramic coffee mug] standing on a polished travertine pedestal,
soft morning light from a large window on the left, gentle shadows, warm neutral background,
subtle steam rising, realistic ceramic texture and tiny water droplets,
shot on 85mm lens, shallow depth of field, clean commercial aesthetic, high detail.
```

**Портрет для личного бренда**

```
Natural portrait of a [confident woman in her 30s, entrepreneur] sitting in a modern bright office,
soft diffused window light, warm skin tones, real skin texture with visible pores,
wearing a [beige linen blazer], relaxed genuine smile, looking slightly off camera,
shot on 50mm lens at f/1.8, blurred background, editorial magazine style.
```

**Фон для рекламы (пустое место под текст)**

```
Minimalist advertising background, soft gradient from [sage green] to cream,
a single eucalyptus branch casting a long soft shadow across the surface,
large empty space on the right side for text, studio lighting, calm premium mood,
clean composition, no people, no text, high resolution.
```

**Еда (food-съёмка)**

```
Close-up food photography of a [freshly baked croissant] on a rustic wooden board,
golden flaky layers, crumbs scattered, a cup of cappuccino blurred in the background,
warm side light from a cafe window, appetizing realistic textures, steam and fine details,
shot on 100mm macro lens, shallow depth of field, cozy morning atmosphere.
```

**Интерьер**

```
Interior photo of a [small Scandinavian-style coffee shop], light oak furniture, white walls,
green plants, sunlight streaming through large windows creating soft light patches on the floor,
realistic materials: wood grain, linen, ceramic, brushed brass details,
wide-angle 24mm lens, eye-level view, architectural magazine style, calm inviting mood.
```

**Image-to-video: оживить фото товара (только движение и камера)**

```
Slow cinematic push-in towards the product, camera gently orbits slightly to the right.
Steam slowly rises from the cup, soft light flickers subtly as if from a window.
Smooth steady motion, no sudden cuts, the product stays unchanged and in focus.
```

**Image-to-video: оживить портрет**

```
The person slowly turns her head towards the camera and gives a soft natural smile.
Hair moves slightly in a light breeze. Camera does a slow dolly-in at eye level.
Natural subtle movements, realistic, calm pacing, face stays consistent.
```

**Text-to-video: рекламная сцена**

```
Cinematic shot: a barista pours latte art into a white cup in a cozy sunlit coffee shop.
Camera starts with a close-up of the milk stream, then slowly pulls back to reveal the cafe.
Warm golden morning light, soft dust particles in the air, shallow depth of field,
realistic textures, calm atmosphere, commercial film look.
```

**Текст для озвучки (пишешь в LLM на русском, затем вставляешь в синтез речи)**

```
Напиши текст закадрового голоса для рекламного ролика длиной [15] секунд.
Продукт: [что продаёшь]. Аудитория: [кто покупает]. Главная выгода: [одна мысль].
Тон: [спокойный, тёплый, уверенный]. Короткие фразы, без канцелярита,
в конце — призыв: [записаться / написать в директ / перейти по ссылке].
```

**Помощник по промптам (в LLM на русском)**

```
Помоги составить промпт на английском для генерации изображения.
Что нужно: [описание задачи, например фото моего товара для сторис].
Разложи по формуле: объект, сцена, свет, стиль, камера/объектив, композиция, детали.
Дай 3 варианта промпта по 3-5 строк и коротко объясни разницу между ними.
```

## Частые ошибки

- **Короткий промпт «красивая кофейня»** → описывай по формуле: что в кадре, где, какой свет, какой стиль, каким объективом снято.
- **Общие слова «качественно, красиво, реалистично»** → конкретика света и материалов: «soft window light from the left», «matte ceramic», «brushed brass», «real skin texture».
- **В image-to-video заново описываешь всю картинку** → модель уже видит фото. Пиши только, что двигается и как движется камера.
- **Меняешь сразу пять вещей в промпте** → одна правка за раз. Так ты понимаешь, что именно улучшило или испортило результат.
- **Бросаешь после первой неудачной генерации** → нормально делать 3-5 итераций. Первый результат редко лучший.
- **Генерируешь свой товар «по описанию»** → загрузи фото товара как референс, иначе модель нарисует похожий, но чужой продукт.
- **Требуешь от видео слишком много действий в одном ролике** → одна сцена, одно главное движение, одно движение камеры.

## Полезные ссылки

- [Higgsfield](https://higgsfield.ai)
- [CapCut — монтаж и наложение озвучки](https://www.capcut.com)

> Модели внутри Higgsfield регулярно обновляются и появляются новые. Какую модель брать под конкретную задачу — разбираем на созвоне, ориентируйся на мои подсказки.
