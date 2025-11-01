# Arc Treasury - Vercel Deploy Script
# Автоматический деплой на Vercel

Write-Host "🚀 Arc Treasury - Vercel Deployment" -ForegroundColor Cyan
Write-Host "====================================`n" -ForegroundColor Cyan

# Step 1: Build project
Write-Host "[1/2] Building project..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Build successful`n" -ForegroundColor Green

# Step 2: Deploy to Vercel
Write-Host "[2/2] Deploying to Vercel..." -ForegroundColor Yellow
Write-Host "Please make sure you're logged in to Vercel CLI" -ForegroundColor Gray
Write-Host ""

vercel --prod

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Deployment failed!" -ForegroundColor Red
    Write-Host "Try running: vercel login" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n✅ Deployment successful!" -ForegroundColor Green
Write-Host "🎉 Your site is now live!" -ForegroundColor Cyan

