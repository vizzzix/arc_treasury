# 🚀 Инструкция по развертыванию на Vercel

## Быстрое развертывание

### Вариант 1: Через Vercel CLI (рекомендуется)

1. **Авторизуйтесь в Vercel:**
```bash
vercel login
```

2. **Разверните проект:**
```bash
vercel deploy --prod --yes
```

### Вариант 2: Через веб-интерфейс Vercel

1. Перейдите на [vercel.com](https://vercel.com)
2. Войдите в аккаунт
3. Нажмите "Add New Project"
4. Импортируйте git репозиторий (если есть) или загрузите файлы
5. Настройки проекта:
   - **Framework Preset:** Vite
   - **Root Directory:** ./
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

### Вариант 3: Git Integration (автоматическое развертывание)

1. **Создайте git репозиторий (если еще нет):**
```bash
git add .
git commit -m "Optimize code with Context7 updates"
git push origin main
```

2. **Подключите репозиторий к Vercel:**
   - Перейдите на vercel.com
   - Нажмите "Add New Project"
   - Выберите ваш git репозиторий
   - Vercel автоматически определит настройки Vite

## Текущая конфигурация проекта

Проект уже настроен для Vercel через `vercel.json`:

```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

## Оптимизации в проекте

✅ QueryClient оптимизирован (staleTime, gcTime, retry)  
✅ Контексты оптимизированы (useMemo, useCallback)  
✅ Vite конфигурация оптимизирована (chunking, minification)  
✅ Ethers providers кешированы  

## Проверка развертывания

После развертывания проверьте:

1. **Сборка проекта успешна:**
```bash
npm run build
```

2. **Локальный предпросмотр:**
```bash
npm run preview
```

3. **Проверка на Vercel:**
   - URL будет предоставлен после развертывания
   - Обычно: `https://arc-treasury-[hash].vercel.app`

## Переменные окружения (если нужны)

Если требуется настройка переменных окружения на Vercel:

1. Перейдите в Settings проекта на Vercel
2. Выберите "Environment Variables"
3. Добавьте необходимые переменные

## Устранение проблем

### Ошибка: "No existing credentials found"
```bash
vercel login
```

### Ошибка сборки
Проверьте, что все зависимости установлены:
```bash
npm install
npm run build
```

### Ошибка маршрутизации
Убедитесь, что `vercel.json` содержит правильные rewrites для SPA.

---

**Проект:** arc-treasury  
**Фреймворк:** Vite + React  
**Команда:** claimpilots-projects

