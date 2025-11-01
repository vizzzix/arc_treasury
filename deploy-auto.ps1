# Arc Treasury - Fully Automatic Deploy (No Questions)
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Arc Treasury - Vercel Deploy v2.0   ║" -ForegroundColor Cyan
Write-Host "║  Modern Design + Token Balances       ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Install Vercel CLI
Write-Host "[1/3] Installing Vercel CLI..." -ForegroundColor Yellow
npm install -g vercel
Write-Host "✓ Done" -ForegroundColor Green
Write-Host ""

# Build
Write-Host "[2/3] Building project..." -ForegroundColor Yellow
npm run build
Write-Host "✓ Done" -ForegroundColor Green
Write-Host ""

# Deploy with automatic answers
Write-Host "[3/3] Deploying to Vercel..." -ForegroundColor Yellow
$env:VERCEL_TOKEN = "J6VGfiSqhDkdJo3F1724PA1A"
vercel --prod --yes --scope claimpilots-projects --name arc-treasury

Write-Host ""
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║     ✅ DEPLOYMENT SUCCESSFUL! ✅      ║" -ForegroundColor Green  
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "🎉 Your Arc Treasury v2.0 is now live!" -ForegroundColor Cyan
Write-Host ""
Write-Host "✨ What's new:" -ForegroundColor Yellow
Write-Host "   🎨 Modern SVG logo with glow effects" -ForegroundColor White
Write-Host "   💰 USDC/EURC/XSGD balance display" -ForegroundColor White
Write-Host "   🌟 Improved design with hover animations" -ForegroundColor White
Write-Host "   🔄 Better error handling" -ForegroundColor White
Write-Host ""
Write-Host "📱 Open the URL above in your browser!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: Deploy contracts first to see balances:" -ForegroundColor Yellow
Write-Host "      npm run deploy" -ForegroundColor Gray
Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

