const PARAM_DATA = {
    // Общие параметры Маркета
    "pmax": { desc: "Максимальная цена лота (в рублях)", cat: "market_general" },
    "pmin": { desc: "Минимальная цена лота (в рублях)", cat: "market_general" },
    "currency": { desc: "Валюта отображения цен (rub, usd, eur, uah, kzt)", cat: "market_general" },
    "price": { desc: "Точная цена покупки товара в рублях (защита от изменения цены)", cat: "market_general" },
    "rt": { desc: "Наличие бана сообщества Steam (yes / no / nomatter)", cat: "steam" },
    "daybreak": { desc: "Минимальная отлёга аккаунта в днях от видимой активности", cat: "market_general" },
    "order_by": { desc: "Сортировка (price_to_up, pdate_to_down, title)", cat: "market_general" },
    "title": { desc: "Поиск по ключевым словам в заголовке лота", cat: "market_general" },
    "page": { desc: "Номер страницы выдачи (1, 2, 3...)", cat: "market_general" },
    "limit": { desc: "Количество результатов на странице (по умолчанию 30, до 100)", cat: "market_general" },
    "tag_id[]": { desc: "ID тега или категории лота на Маркете", cat: "market_general" },
    "not_tag_id[]": { desc: "Исключить лоты с определенным тегом", cat: "market_general" },
    "favorite": { desc: "Отображать только избранные лоты (1 = да)", cat: "market_general" },
    "item_domain": { desc: "Домен почты аккаунта (mail.ru, rambler.ru, outlook.com)", cat: "market_general" },
    "email_type[]": { desc: "Тип почты (autoreg = авторег, native = родная, no = без почты)", cat: "market_general" },
    "resale": { desc: "Только перепродажа или личные аккаунты (0 = личный, 1 = перепродажа)", cat: "market_general" },
    "guarantee": { desc: "Наличие гарантии на товар (1 = 12/24 часа, 0 = без гарантии)", cat: "market_general" },
    "proxy_id": { desc: "ID привязанного прокси на Маркете для проверки лота", cat: "market_general" },

    // Discord
    "nitro": { desc: "Наличие подписки Discord Nitro (1 = есть активный Nitro, 0 = нет)", cat: "discord" },
    "nitro_type": { desc: "Тип Нитро (Classic, Full, Basic)", cat: "discord" },
    "discord_id": { desc: "Числовой ID аккаунта Discord", cat: "discord" },
    "badge[]": { desc: "Значки профиля Discord (HypeSquad, Active Developer, Nitro)", cat: "discord" },
    "payment_method": { desc: "Привязанный метод оплаты (1 = карта/PayPal привязана)", cat: "discord" },
    "guilds_count": { desc: "Количество серверов (гильдий), на которых состоит аккаунт", cat: "discord" },

    // Steam
    "game[]": { desc: "ID игры Steam на Маркете (730 = CS2, 570 = Dota 2). См. вкладку «Справка» → ID игр", cat: "steam" },
    "steam_id": { desc: "SteamID64 пользователя или аккаунта", cat: "steam" },
    "hours_played": { desc: "Минимальное количество часов в игре", cat: "steam" },
    "hours_played_max": { desc: "Максимальное количество часов в игре", cat: "steam" },
    "has_csgo_prime": { desc: "Наличие прайм-статуса в CS2 (1 = есть прайм)", cat: "steam" },
    "csgo_mm_rank": { desc: "Минимальное звание в соревновательном режиме CS2", cat: "steam" },
    "dota2_mmr_min": { desc: "Минимальный одиночный MMR в Dota 2", cat: "steam" },
    "dota2_mmr_max": { desc: "Максимальный MMR в Dota 2", cat: "steam" },
    "steam_level": { desc: "Минимальный уровень аккаунта Steam", cat: "steam" },
    "steam_balance": { desc: "Минимальный баланс кошелька Steam", cat: "steam" },
    "steam_games_count": { desc: "Количество купленных игр на аккаунте", cat: "steam" },
    "steam_trade_ban": { desc: "Наличие трейд-бана КТ (0 = нет бана)", cat: "steam" },
    "steam_vac_ban": { desc: "Наличие VAC бана на аккаунте (0 = чистый)", cat: "steam" },

    // Telegram
    "telegram_id": { desc: "Числовой Telegram ID пользователя", cat: "telegram" },
    "telegram_username": { desc: "Юзернейм в Telegram (@username)", cat: "telegram" },
    "country[]": { desc: "Код страны аккаунта (RU = Россия, US = США, ID = Индонезия, TR = Турция)", cat: "telegram" },
    "tdata": { desc: "Наличие папки tdata в архиве аккаунта (1 = есть)", cat: "telegram" },
    "session": { desc: "Наличие .session файла (Pyrogram/Telethon)", cat: "telegram" },
    "two_fa": { desc: "Наличие облачного пароля 2FA (0 = нет пароля)", cat: "telegram" },
    "telegram_channels_count": { desc: "Минимальное количество администрируемых каналов", cat: "telegram" },
    "telegram_contacts_count": { desc: "Минимальное количество контактов в записной книжке", cat: "telegram" },
    "telegram_spam_block": { desc: "Наличие спам-блока от @SpamBot (0 = нет блока)", cat: "telegram" },
    "telegram_premium": { desc: "Активная подписка Telegram Premium (1 = есть)", cat: "telegram" },

    // Fortnite & Riot
    "fortnite_skins_count": { desc: "Минимальное количество скинов в Fortnite", cat: "fortnite" },
    "fortnite_vbucks": { desc: "Баланс V-Bucks на аккаунте", cat: "fortnite" },
    "fortnite_level": { desc: "Уровень аккаунта Fortnite", cat: "fortnite" },
    "fortnite_rare_skins[]": { desc: "Наличие редких скинов (Black Knight, Renegade Raider)", cat: "fortnite" },
    "valorant_skin_count": { desc: "Минимальное количество платных скинов в Valorant", cat: "riot" },
    "valorant_rank": { desc: "Ранг в соревновательном режиме Valorant", cat: "riot" },
    "valorant_region": { desc: "Регион аккаунта Valorant (EU, NA, AP, KR)", cat: "riot" },
    "riot_id": { desc: "Имя пользователя Riot ID", cat: "riot" },

    // Другие игры и соцсети
    "genshin_adventure_rank": { desc: "Ранг приключений в Genshin Impact", cat: "genshin" },
    "genshin_primogems": { desc: "Количество примогемов (камней истока)", cat: "genshin" },
    "roblox_robux": { desc: "Баланс Robux на аккаунте Roblox", cat: "roblox" },
    "roblox_rap": { desc: "Стоимость инвентаря RAP в Roblox", cat: "roblox" },
    "gta5": { desc: "Наличие игры GTA V (1 = есть)", cat: "gta5" },
    "gta5_money": { desc: "Баланс денег в GTA Online", cat: "gta5" },
    "followers_count": { desc: "Количество подписчиков (TikTok, Instagram, VK)", cat: "social" },

    // Форум Zelenka.guru
    "user_id": { desc: "ID продавца или пользователя на Форуме/Маркете", cat: "forum" },
    "thread_id": { desc: "ID темы на форуме Zelenka.guru", cat: "forum" },
    "post_id": { desc: "ID конкретного сообщения в теме форума", cat: "forum" },
    "forum_id": { desc: "ID раздела или подраздела на форуме", cat: "forum" },
    "post_body": { desc: "Текст сообщения или комментария", cat: "forum" },
    "comment": { desc: "Текст комментария или отзыва при покупке/переводе", cat: "forum" },
    "amount": { desc: "Сумма перевода средств или пополнения", cat: "forum" },
    "secret_answer": { desc: "Секретный ответ от маркета для подтверждения перевода/операции", cat: "forum" },
    "transfer_title": { desc: "Название или примечание денежного перевода", cat: "forum" },
    "hold_time": { desc: "Время холда (удержания) перевода в часах", cat: "forum" },
    "recipient_id": { desc: "ID получателя перевода средств", cat: "forum" },
    "thread_title": { desc: "Заголовок создаваемой темы на форуме", cat: "forum" },
    "creator_user_id": { desc: "ID автора тем (фильтр списка тем)", cat: "forum" },
    "prefix_ids[]": { desc: "ID префиксов тем (теги в заголовке)", cat: "forum" },
    "thread_tag_id": { desc: "ID тега темы", cat: "forum" },
    "order": { desc: "Поле сортировки (thread_create_date, thread_update_date…)", cat: "forum" },
    "direction": { desc: "Направление сортировки (asc / desc)", cat: "forum" },
    "fields_include": { desc: "Доп. поля в ответе (через запятую)", cat: "forum" },
    "sticky": { desc: "Только закреплённые темы (1 = да)", cat: "forum" },
    "state": { desc: "Состояние тем (visible, deleted…)", cat: "forum" },
    "period": { desc: "Период выборки (day, week, month…)", cat: "forum" },
    "title_only": { desc: "Искать только в заголовках тем (1 = да)", cat: "forum" }
};

/** ID пользователя в примерах шаблонов (форум, thread/post). */
const LZT_MY_ID = 3450027;

const FULL_API_DATABASE = [
    // --- МАРКЕТ: ПОИСК АККАУНТОВ ---
    {
        id: "steam_search",
        category: "market",
        cat: "market",
        title: "Парсер Steam (CS2 Prime)",
        iconClass: "fa-brands fa-steam",
        desc: "Поиск аккаунтов CS2 Prime до 450₽ с отлёгой от 10 дней",
        full_desc: "Основной эндпоинт для поиска игровых аккаунтов Steam на Маркете с гибкой фильтрацией по часам, играм, инвентарю и отлёге. Позволяет находить аккаунты для перепродажи или личного использования.",
        method: "GET",
        url: "https://prod-api.lzt.market/steam",
        params: { "game[]": "730", "pmax": 450, "daybreak": 10, "order_by": "price_to_up" },
        param_details: [
            { name: "game[]", desc: "ID игры (730 = CS2, 570 = Dota 2, 440 = TF2, 252490 = Rust)" },
            { name: "pmin", desc: "Минимальная цена лота в рублях" },
            { name: "pmax", desc: "Максимальная цена лота в рублях" },
            { name: "daybreak", desc: "Минимальная отлёга аккаунта в днях (видимая активность Steam)" },
            { name: "order_by", desc: "Сортировка: price_to_up — дешевле, pdate_to_down — новее" },
            { name: "hours_played", desc: "Минимальное количество часов в игре" },
            { name: "hours_played_max", desc: "Максимальное количество часов в игре" },
            { name: "has_csgo_prime", desc: "1 = аккаунт с Prime Status в CS2" },
            { name: "csgo_mm_rank", desc: "Минимальное звание в соревновательном режиме CS2" },
            { name: "dota2_mmr_min", desc: "Минимальный MMR в Dota 2" },
            { name: "steam_level", desc: "Минимальный уровень профиля Steam" },
            { name: "steam_balance", desc: "Минимальный баланс кошелька Steam" },
            { name: "steam_games_count", desc: "Минимальное число игр в библиотеке" },
            { name: "steam_trade_ban", desc: "0 = нет трейд-бана, 1 = есть бан" },
            { name: "steam_vac_ban", desc: "0 = нет VAC бана на аккаунте" },
            { name: "rt", desc: "Бан сообщества Steam: yes / no / nomatter" },
            { name: "title", desc: "Поиск по словам в названии лота" },
            { name: "page", desc: "Номер страницы выдачи (1, 2, 3…)" },
            { name: "limit", desc: "Лотов на странице (до 100)" }
        ]
    },
    {
        id: "telegram_search",
        category: "market",
        cat: "market",
        title: "Парсер Telegram США (+1)",
        iconClass: "fa-brands fa-telegram",
        desc: "Автореги/TData Telegram с кодом страны США (+1)",
        full_desc: "Поиск сессий (Pyrogram/Telethon) или папок TData для Telegram. Позволяет фильтровать аккаунты по странам (Россия, США, Индонезия), наличию 2FA пароля и спам-блоку.",
        method: "GET",
        url: "https://prod-api.lzt.market/telegram",
        params: { "pmax": 45, "country[]": "US", "order_by": "pdate_to_down_active" },
        param_details: [
            { name: "country[]", desc: "Код страны номера телефона (US = США, RU = Россия, ID = Индонезия)" },
            { name: "tdata / session", desc: "1 = обязательное наличие формата TData или .session" },
            { name: "two_fa", desc: "0 = без облачного пароля 2FA, 1 = с паролем" },
            { name: "telegram_spam_block", desc: "0 = чистый аккаунт без спам-блока от @SpamBot" }
        ]
    },
    {
        id: "discord_search",
        category: "market",
        cat: "market",
        title: "Парсер Discord Nitro",
        iconClass: "fa-brands fa-discord",
        desc: "Поиск аккаунтов Discord с активной подпиской Nitro",
        full_desc: "Поиск токенов Discord с активной подпиской Nitro (Full или Classic), привязанными методами оплаты или редкими значками профиля (HypeSquad, Active Developer).",
        method: "GET",
        url: "https://prod-api.lzt.market/discord",
        params: { "pmax": 200, "nitro": 1 },
        param_details: [
            { name: "nitro", desc: "1 = наличие активной подписки Discord Nitro" },
            { name: "nitro_type", desc: "Тип Нитро (Classic, Full, Basic)" },
            { name: "badge[]", desc: "Фильтр по значкам профиля (Active Developer, Early Supporter)" },
            { name: "payment_method", desc: "1 = привязана банковская карта или PayPal" }
        ]
    },
    {
        id: "fortnite_search",
        category: "market",
        cat: "market",
        title: "Парсер Fortnite (Редкие скины)",
        iconClass: "fa-solid fa-gamepad",
        desc: "Поиск аккаунтов со скинами Black Knight или Renegade Raider",
        full_desc: "Поиск аккаунтов Epic Games / Fortnite по количеству скинов, балансу V-Bucks, уровню боевого пропуска и наличию эксклюзивных редких экипировок.",
        method: "GET",
        url: "https://prod-api.lzt.market/fortnite",
        params: { "fortnite_skins_count": 50, "pmax": 1000 },
        param_details: [
            { name: "fortnite_skins_count", desc: "Минимальное общее количество скинов на аккаунте" },
            { name: "fortnite_vbucks", desc: "Минимальный текущий баланс V-Bucks" },
            { name: "fortnite_rare_skins[]", desc: "Название редкого скина (Black Knight, Travis Scott)" }
        ]
    },
    {
        id: "valorant_search",
        category: "market",
        cat: "market",
        title: "Парсер Valorant (EU Регион)",
        iconClass: "fa-solid fa-crosshairs",
        desc: "Поиск аккаунтов Valorant с платными скинами в регионе EU",
        full_desc: "Поиск аккаунтов Riot Games / Valorant с фильтрацией по региону сервера (EU, NA, AP), соревновательному званию и количеству купленных ножей/скинов.",
        method: "GET",
        url: "https://prod-api.lzt.market/riot",
        params: { "valorant_region": "EU", "valorant_skin_count": 10 },
        param_details: [
            { name: "valorant_region", desc: "Игровой регион (EU = Европа, NA = Америка, AP = Азия)" },
            { name: "valorant_rank", desc: "Минимальный ранг в соревновательном режиме" },
            { name: "valorant_skin_count", desc: "Минимальное количество платных скинов" }
        ]
    },
    {
        id: "genshin_search",
        category: "market",
        cat: "market",
        title: "Парсер Genshin Impact (5★ Персонажи)",
        iconClass: "fa-solid fa-wand-magic-sparkles",
        desc: "Поиск аккаунтов Genshin Impact по рангу приключений и примогемам",
        full_desc: "Эндпоинт для поиска аккаунтов HoYoverse (Genshin Impact, Honkai: Star Rail). Позволяет искать аккаунты с огромным запасом камней истока или конкретными 5-звездочными героями.",
        method: "GET",
        url: "https://prod-api.lzt.market/mihoyo",
        params: { "genshin_adventure_rank": 45, "pmax": 500 },
        param_details: [
            { name: "genshin_adventure_rank", desc: "Минимальный ранг приключений (AR)" },
            { name: "genshin_primogems", desc: "Минимальное количество примогемов на балансе" }
        ]
    },
    {
        id: "roblox_search",
        category: "market",
        cat: "market",
        title: "Парсер Roblox (Robux & RAP)",
        iconClass: "fa-solid fa-cube",
        desc: "Поиск аккаунтов Roblox с балансом Robux или дорогим инвентарем",
        full_desc: "Поиск аккаунтов Roblox с фильтрацией по текущему балансу Robux, стоимости лимитированных предметов (RAP) и наличию голосового чата (Voice Chat).",
        method: "GET",
        url: "https://prod-api.lzt.market/roblox",
        params: { "roblox_robux": 100, "pmax": 300 },
        param_details: [
            { name: "roblox_robux", desc: "Минимальный баланс Robux на аккаунте" },
            { name: "roblox_rap", desc: "Минимальная стоимость лимиток RAP в Robux" }
        ]
    },
    {
        id: "gta5_search",
        category: "market",
        cat: "market",
        title: "Парсер GTA V (Social Club / Epic)",
        iconClass: "fa-solid fa-car",
        desc: "Поиск аккаунтов с игрой GTA V и прокачкой в GTA Online",
        full_desc: "Поиск аккаунтов Rockstar Social Club, Steam или Epic Games с купленной игрой Grand Theft Auto V, а также балансом долларов в GTA Online.",
        method: "GET",
        url: "https://prod-api.lzt.market/socialclub",
        params: { "gta5": 1, "pmax": 250 },
        param_details: [
            { name: "gta5", desc: "1 = обязательное наличие лицензии GTA V" },
            { name: "gta5_money", desc: "Минимальный баланс виртуальных денег в GTA Online" }
        ]
    },
    {
        id: "market_general",
        category: "market",
        cat: "market",
        title: "Общий поиск по всем разделам Маркета",
        iconClass: "fa-solid fa-magnifying-glass-dollar",
        desc: "Глобальный поиск товаров на Маркете по ключевому слову в названии",
        full_desc: "Ищет любые лоты во всех категориях Маркета одновременно. Идеально подходит для мониторинга появления конкретных названий игр, программ или сервисов.",
        method: "GET",
        url: "https://prod-api.lzt.market/",
        params: { "title": "VPN", "pmax": 100, "order_by": "pdate_to_down" },
        param_details: [
            { name: "title", desc: "Ключевое слово для поиска в заголовках лотов" },
            { name: "pmin", desc: "Минимальная цена в рублях" },
            { name: "pmax", desc: "Максимальная цена в рублях" },
            { name: "order_by", desc: "Сортировка выдачи" },
            { name: "page", desc: "Номер страницы" },
            { name: "limit", desc: "Лотов на странице (до 100)" }
        ]
    },

    // --- МАРКЕТ: ОПЕРАЦИИ И ПОКУПКИ ---
    {
        id: "item_fast_buy",
        category: "market",
        cat: "market",
        title: "Быстрая покупка лота (Fast Buy)",
        iconClass: "fa-solid fa-bolt",
        desc: "Моментальная покупка товара по ID без предварительной проверки",
        full_desc: "Самый быстрый способ выкупить лот (для снайпер-ботов). Запрос моментально списывает средства и передает данные аккаунта без долгой проверки на валидность.",
        method: "POST",
        url: `https://prod-api.lzt.market/${LZT_MY_ID}/fast-buy`,
        params: { "price": 150 },
        param_details: [
            { name: "price", desc: "Точная цена лота в рублях (защита от того, если продавец резко повысил цену)" }
        ]
    },
    {
        id: "item_safe_buy",
        category: "market",
        cat: "market",
        title: "Безопасная покупка лота (с проверкой)",
        iconClass: "fa-solid fa-shield-halved",
        desc: "Покупка лота с предварительной проверкой валидности пароля/почты",
        full_desc: "Стандартная покупка товара на Маркете. Сервер сначала проверит валидность аккаунта через прокси и сменит пароль (если требуется), и только при успехе совершит покупку.",
        method: "POST",
        url: `https://prod-api.lzt.market/${LZT_MY_ID}/buy`,
        params: { "price": 150 },
        param_details: [
            { name: "price", desc: "Точная ожидаемая цена лота" }
        ]
    },
    {
        id: "bump_items",
        category: "market",
        cat: "market",
        title: "Массовое поднятие лотов (Бамп)",
        iconClass: "fa-solid fa-arrow-up-right-dots",
        desc: "Поднять все ваши активные товары в верх списка поиска Маркета",
        full_desc: "Поднимает все ваши непроданные товары в начало поисковой выдачи Маркета. Рекомендуется ставить на крон/таймер раз в 6 часов для максимальных продаж.",
        method: "POST",
        url: "https://prod-api.lzt.market/user/bump",
        params: {},
        param_details: []
    },
    {
        id: "market_me",
        category: "market",
        cat: "market",
        title: "Мой баланс и статистика на Маркете",
        iconClass: "fa-solid fa-wallet",
        desc: "Получить доступный баланс, сумму холда и количество активных лотов",
        full_desc: "Возвращает финансовую информацию вашего профиля на Маркете: текущий баланс в рублях, сумму на удержании (холде), а также общие показатели продаж.",
        method: "GET",
        url: "https://prod-api.lzt.market/me",
        params: {},
        param_details: []
    },
    {
        id: "balance_transfer",
        category: "market",
        cat: "market",
        title: "Перевод денег другому пользователю",
        iconClass: "fa-solid fa-money-bill-transfer",
        desc: "Отправить рубли с баланса Маркета другому юзеру Лолза",
        full_desc: "Выполняет денежный перевод с вашего баланса Маркета на баланс другого пользователя Zelenka.guru по его ID или никнейму. Требует передачи секретного ответа.",
        method: "POST",
        url: "https://prod-api.lzt.market/balance/transfer",
        params: { "recipient_id": LZT_MY_ID, "amount": 100, "comment": "Подарок от бота", "secret_answer": "ваш_секретный_ответ" },
        param_details: [
            { name: "recipient_id", desc: "Числовой ID получателя перевода" },
            { name: "amount", desc: "Сумма перевода в рублях" },
            { name: "comment", desc: "Примечание к переводу (отображается в истории)" },
            { name: "secret_answer", desc: "Секретный ответ от вашего аккаунта для подтверждения транзакции" }
        ]
    },

    // --- ФОРУМ ZELENKA.GURU ---
    {
        id: "forum_me",
        category: "forum",
        cat: "forum",
        title: "Мой аккаунт на Форуме Zelenka",
        iconClass: "fa-solid fa-id-card",
        desc: "Получить свою группу, количество симпатий, лайков и сообщений",
        full_desc: "Возвращает полную информацию об авторизованном пользователе на форуме Zelenka.guru: ID, никнейм, ссылку на аватар, количество симпатий, трофеи и привилегии.",
        method: "GET",
        url: "https://api.lolz.live/users/me",
        params: {},
        param_details: []
    },
    {
        id: "forum_user",
        category: "forum",
        cat: "forum",
        title: "Мой профиль на форуме (по ID)",
        iconClass: "fa-solid fa-user",
        desc: "Получить публичную статистику вашего аккаунта",
        full_desc: "Профиль пользователя на форуме по user_id (ваш ID: " + LZT_MY_ID + ").",
        method: "GET",
        url: `https://api.lolz.live/users/${LZT_MY_ID}`,
        params: {},
        param_details: []
    },
    {
        id: "forum_threads",
        category: "forum",
        cat: "forum",
        title: "Список последних тем в разделе",
        iconClass: "fa-solid fa-list",
        desc: "Получить актуальные темы из конкретного раздела форума",
        full_desc: "Возвращает список свежих тем из указанного раздела (forum_id). Включает заголовки, имена авторов, количество просмотров и ответов.",
        method: "GET",
        url: "https://api.lolz.live/threads",
        params: { "forum_id": 84, "limit": 20, "user_id": LZT_MY_ID },
        param_details: [
            { name: "forum_id", desc: "ID раздела форума (84 = Тестовый раздел, 8 = Оффтопик, 83 = Python)" },
            { name: "limit", desc: "Количество возвращаемых тем (до 50)" }
        ]
    },
    {
        id: "forum_thread_get",
        category: "forum",
        cat: "forum",
        title: "Чтение темы и её содержимого",
        iconClass: "fa-solid fa-file-lines",
        desc: "Получить текст шапки и подробности темы по её ID",
        full_desc: "Загружает полную информацию о конкретной теме на форуме по её thread_id, включая главное сообщение автора и теги.",
        method: "GET",
        url: `https://api.lolz.live/threads/${LZT_MY_ID}`,
        params: {},
        param_details: []
    },
    {
        id: "forum_thread_create",
        category: "forum",
        cat: "forum",
        title: "Создание новой темы на Форуме",
        iconClass: "fa-solid fa-pen-to-square",
        desc: "Опубликовать новую тему в заданном разделе",
        full_desc: "Позволяет вашему боту или скрипту автоматически создавать новые темы на форуме Zelenka.guru. Требует указания ID раздела, заголовка и текста.",
        method: "POST",
        url: "https://api.lolz.live/threads",
        params: {},
        body: { forum_id: 84, thread_title: "Название темы", post_body: "Содержимое темы" },
        param_details: [
            { name: "forum_id", desc: "ID раздела, где будет создана тема" },
            { name: "thread_title", desc: "Заголовок новой темы" },
            { name: "post_body", desc: "Главный текст сообщения (поддерживает BB-коды)" }
        ]
    },
    {
        id: "forum_posts",
        category: "forum",
        cat: "forum",
        title: "Получение сообщений из темы",
        iconClass: "fa-solid fa-comments",
        desc: "Загрузить список ответов и комментариев в теме",
        full_desc: "Возвращает список сообщений (постов) пользователей в конкретной теме с пагинацией.",
        method: "GET",
        url: "https://api.lolz.live/posts",
        params: { "thread_id": LZT_MY_ID, "limit": 20 },
        param_details: [
            { name: "thread_id", desc: "ID темы для загрузки комментариев" }
        ]
    },
    {
        id: "forum_post_create",
        category: "forum",
        cat: "forum",
        title: "Отправка сообщения / комментария в тему",
        iconClass: "fa-solid fa-paper-plane",
        desc: "Написать ответ в существующую тему по её ID",
        full_desc: "Опубликовать новое сообщение или комментарий в указанной теме форума. Отлично подходит для ботов авто-ответа или участия в розыгрышах.",
        method: "POST",
        url: "https://api.lolz.live/posts",
        params: {},
        body: { thread_id: LZT_MY_ID, post_body: "Спасибо за полезный софт!" },
        param_details: [
            { name: "thread_id", desc: "ID темы, куда отправляется ответ" },
            { name: "post_body", desc: "Текст вашего ответа или комментария" }
        ]
    },
    {
        id: "forum_post_like",
        category: "forum",
        cat: "forum",
        title: "Поставить симпатию / лайк на пост",
        iconClass: "fa-solid fa-heart",
        desc: "Влепить симпу или лайк на сообщение пользователя",
        full_desc: "Отправляет запрос на добавление симпатии (или лайка в разделах без симпатий) к конкретному сообщению по его post_id.",
        method: "POST",
        url: `https://api.lolz.live/posts/${LZT_MY_ID}/like`,
        params: {},
        param_details: []
    },
    {
        id: "forum_notif",
        category: "forum",
        cat: "forum",
        title: "Список моих уведомлений",
        iconClass: "fa-solid fa-bell",
        desc: "Получить последние оповещения на форуме",
        full_desc: "Возвращает список ваших последних уведомлений: новые симпатии, упоминания в темах, ответы на ваши сообщения и переводы средств.",
        method: "GET",
        url: "https://api.lolz.live/notifications",
        params: { "limit": 15 },
        param_details: [
            { name: "limit", desc: "Количество последних уведомлений" }
        ]
    }
];

const TEMPLATES = FULL_API_DATABASE;
const BUILTIN_DOCS = FULL_API_DATABASE;
window.PARAM_DATA = PARAM_DATA;
window.TEMPLATES = TEMPLATES;
window.BUILTIN_DOCS = BUILTIN_DOCS;
