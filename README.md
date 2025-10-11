# NEW GRGY TIMES - Store Frontend

Фронтенд-витрина на Vite + React + TypeScript + Tailwind, подготовленная для деплоя на GitHub Pages и домена newgrgytimes.com.

## Требования

- Node.js 20+ (для локального запуска и сборки).
- Установленные зависимости проекта (npm install).

## Запуск

1. Выполните npm install.
2. Запустите npm run dev.
3. Приложение откроется на http://localhost:5173.

## Сборка

1. Запустите npm run build.
2. Для предпросмотра используйте npm run preview.

## GitHub Pages

1. Убедитесь, что репозиторий не называется username.github.io. Если используется другое имя, обновите base в vite.config.ts (сейчас задано /ngt-site/). Для кастомного домена настройка подходит по умолчанию.
2. Активируйте GitHub Pages в настройках репозитория: Settings -> Pages, источник GitHub Actions.
3. Workflow .github/workflows/deploy.yml автоматически собирает и деплоит проект после пуша в ветку main.

## Данные и ассеты

- Каталог товаров хранится в public/products.json и загружается через fetch.
- Заглушки изображений перечислены в public/images/PLACEHOLDERS.txt. Добавьте реальные JPEG-файлы с указанными именами (например, 800x800 и 1600x1600).
- Логотип находится в public/logo.png. Если файла нет, в шапке появится текст "NEW GRGY TIMES".

## Стек и особенности

- Vite + React 18 + TypeScript.
- Tailwind CSS без внешних UI-китов.
- Состояние корзины сохраняется в localStorage (см. src/lib/useLocalStorage.ts).
- Оформление заказа копирует текст заявки в буфер обмена и открывает Telegram (https://t.me/grgyone).
