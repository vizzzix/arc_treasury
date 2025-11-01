import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Shield, Zap, TrendingUp, ArrowRight, ArrowLeft, Info, CheckCircle2 } from "lucide-react";
import { useTreasury } from "@/contexts/TreasuryContext";
import { useWallet } from "@/contexts/WalletContext";
import { CONTRACT_ADDRESSES } from "@/contracts/contractAddresses";
import { TREASURY_AVATARS, TreasuryMetadata } from "@/types/treasury";
import { toast } from "sonner";

const CreateTreasuryNew = () => {
  const navigate = useNavigate();
  const { createTreasury, loading } = useTreasury();
  const { isConnected, address } = useWallet();
  
  const [step, setStep] = useState(1);
  const [treasuryName, setTreasuryName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(TREASURY_AVATARS[0]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  
  const [allocations, setAllocations] = useState({
    USDC: 50,
    EURC: 30,
    XSGD: 20,
  });
  
  const [autoYield, setAutoYield] = useState(true);
  const [rebalanceThreshold, setRebalanceThreshold] = useState(5);

  const templates = [
    {
      id: "conservative",
      name: "Conservative",
      icon: Shield,
      allocation: { USDC: 70, EURC: 20, XSGD: 10 },
      description: "Максимальная стабильность",
      details: "70% в USD для минимального риска. Идеально для долгосрочных сбережений.",
      apy: "3-5%",
      risk: "Низкий",
      color: "from-blue-500 to-blue-600",
      tips: [
        "✅ Лучший выбор для накопления",
        "✅ Минимальная волатильность",
        "❌ Низкая доходность",
      ],
    },
    {
      id: "balanced",
      name: "Balanced",
      icon: Zap,
      allocation: { USDC: 50, EURC: 30, XSGD: 20 },
      description: "Баланс риска и доходности",
      details: "Диверсификация по регионам. Рекомендуется большинству пользователей.",
      apy: "5-8%",
      risk: "Средний",
      color: "from-purple-500 to-purple-600",
      tips: [
        "✅ Оптимальная диверсификация",
        "✅ Средняя доходность",
        "✅ Подходит для большинства",
      ],
    },
    {
      id: "aggressive",
      name: "Aggressive",
      icon: TrendingUp,
      allocation: { USDC: 30, EURC: 40, XSGD: 30 },
      description: "Максимальная доходность",
      details: "Равное распределение. Для опытных пользователей и международного бизнеса.",
      apy: "8-12%",
      risk: "Высокий",
      color: "from-orange-500 to-red-600",
      tips: [
        "✅ Максимальная доходность",
        "⚠️ Высокая волатильность",
        "⚠️ Для опытных пользователей",
      ],
    },
  ];

  const applyTemplate = (template: typeof templates[0]) => {
    setAllocations(template.allocation);
    setSelectedTemplate(template.id);
  };

  const totalAllocation = Object.values(allocations).reduce((a, b) => a + b, 0);

  const handleCreate = async () => {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!treasuryName.trim()) {
      toast.error("Please enter a treasury name");
      return;
    }

    if (totalAllocation !== 100) {
      toast.error("Total allocation must equal 100%");
      return;
    }

    try {
      const tokens = [CONTRACT_ADDRESSES.USDC, CONTRACT_ADDRESSES.EURC, CONTRACT_ADDRESSES.XSGD];
      const allocationsArray = [allocations.USDC * 100, allocations.EURC * 100, allocations.XSGD * 100];
      const threshold = rebalanceThreshold * 100;

      const treasuryAddress = await createTreasury(tokens, allocationsArray, threshold, autoYield);
      
      if (treasuryAddress) {
        // Save metadata
        const metadata: TreasuryMetadata = {
          name: treasuryName,
          avatar: selectedAvatar,
          createdAt: Date.now(),
          owner: address,
          address: treasuryAddress,
        };

        localStorage.setItem(`treasury_${address}`, treasuryAddress);
        localStorage.setItem(`treasury_metadata_${address}`, JSON.stringify(metadata));
        
        toast.success("Treasury created successfully!");
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Failed to create treasury:", error);
    }
  };

  const getStepIndicator = () => {
    return (
      <div className="flex items-center justify-center gap-2 mb-8">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`
              w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all
              ${step === s ? 'bg-gradient-to-r from-primary to-accent text-white' : 
                step > s ? 'bg-success text-white' : 'bg-secondary text-muted-foreground'}
            `}>
              {step > s ? <CheckCircle2 className="w-5 h-5" /> : s}
            </div>
            {s < 4 && <div className={`w-12 h-1 ${step > s ? 'bg-success' : 'bg-secondary'}`} />}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="container mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold gradient-text">Create Your Treasury</h1>
          <p className="text-lg text-muted-foreground">
            Пошаговая настройка автоматизированного портфеля
          </p>
        </div>

        {/* Step Indicator */}
        {getStepIndicator()}

        {/* Step 1: Name & Avatar */}
        {step === 1 && (
          <Card className="modern-card p-8">
            <h2 className="text-2xl font-bold mb-6">Шаг 1: Имя и Аватар</h2>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Название Treasury</Label>
                <Input
                  value={treasuryName}
                  onChange={(e) => setTreasuryName(e.target.value)}
                  placeholder="Например: Мои Сбережения, Инвестиционный Фонд..."
                  maxLength={30}
                  className="glass-card text-lg"
                />
                <p className="text-xs text-muted-foreground">
                  {treasuryName.length}/30 символов
                </p>
              </div>

              <div className="space-y-3">
                <Label>Выберите Аватар</Label>
                <div className="grid grid-cols-8 gap-2">
                  {TREASURY_AVATARS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setSelectedAvatar(emoji)}
                      className={`
                        w-12 h-12 text-2xl rounded-lg transition-all
                        hover:scale-110
                        ${selectedAvatar === emoji 
                          ? 'bg-gradient-to-br from-primary/30 to-accent/30 ring-2 ring-primary scale-110' 
                          : 'bg-secondary/50 hover:bg-secondary'
                        }
                      `}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-start gap-2">
                  <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold mb-1">💡 Совет:</p>
                    <p className="text-muted-foreground">
                      Выберите запоминающееся имя и эмодзи. Это поможет быстро находить ваш Treasury в будущем!
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  size="lg"
                  onClick={() => setStep(2)}
                  disabled={!treasuryName.trim()}
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90 gap-2"
                >
                  Далее
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 2: Strategy Selection */}
        {step === 2 && (
          <Card className="modern-card p-8">
            <h2 className="text-2xl font-bold mb-6">Шаг 2: Выберите Стратегию</h2>
            
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => applyTemplate(template)}
                  className={`
                    text-left p-6 rounded-xl transition-all
                    ${selectedTemplate === template.id
                      ? 'ring-2 ring-primary bg-gradient-to-br from-primary/20 to-accent/20'
                      : 'modern-card hover:border-primary/30'
                    }
                  `}
                >
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${template.color} flex items-center justify-center mb-4`}>
                    <template.icon className="w-6 h-6 text-white" />
                  </div>
                  
                  <h3 className="font-bold text-lg mb-2">{template.name}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">APY:</span>
                      <span className="font-semibold text-success">{template.apy}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Риск:</span>
                      <span className={`font-semibold ${
                        template.risk === 'Низкий' ? 'text-success' : 
                        template.risk === 'Средний' ? 'text-warning' : 'text-destructive'
                      }`}>
                        {template.risk}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border/50">
                    <div className="flex gap-2 text-xs">
                      <span>💵 {template.allocation.USDC}%</span>
                      <span>💶 {template.allocation.EURC}%</span>
                      <span>💴 {template.allocation.XSGD}%</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {selectedTemplate && (
              <div className="p-4 rounded-lg bg-accent/10 border border-accent/20 mb-6">
                <div className="flex items-start gap-2">
                  <Info className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold mb-2">
                      {templates.find(t => t.id === selectedTemplate)?.details}
                    </p>
                    <ul className="space-y-1">
                      {templates.find(t => t.id === selectedTemplate)?.tips.map((tip, i) => (
                        <li key={i} className="text-muted-foreground">{tip}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setStep(1)}
                className="gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                Назад
              </Button>
              <Button
                size="lg"
                onClick={() => setStep(3)}
                disabled={!selectedTemplate}
                className="bg-gradient-to-r from-primary to-accent hover:opacity-90 gap-2"
              >
                Далее
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 3: Fine-tune Allocation */}
        {step === 3 && (
          <Card className="modern-card p-8">
            <h2 className="text-2xl font-bold mb-6">Шаг 3: Точная Настройка</h2>
            
            <div className="space-y-6 mb-6">
              {Object.entries(allocations).map(([token, value]) => (
                <div key={token} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {token === 'USDC' ? '💵' : token === 'EURC' ? '💶' : '💴'}
                      </span>
                      <div>
                        <div className="font-semibold">{token}</div>
                        <div className="text-sm text-muted-foreground">
                          {token === 'USDC' ? 'US Dollar' : token === 'EURC' ? 'Euro' : 'Singapore Dollar'}
                        </div>
                      </div>
                    </div>
                    <div className="text-3xl font-bold gradient-text">{value}%</div>
                  </div>
                  <Slider
                    value={[value]}
                    onValueChange={(v) => setAllocations(prev => ({ ...prev, [token]: v[0] }))}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>
              ))}

              <div className="p-4 rounded-lg bg-secondary/50 border border-border/50">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Итого:</span>
                  <span className={`text-2xl font-bold ${totalAllocation === 100 ? 'text-success' : 'text-destructive'}`}>
                    {totalAllocation}%
                  </span>
                </div>
                {totalAllocation !== 100 && (
                  <p className="text-sm text-destructive mt-2">
                    ⚠️ Сумма должна быть ровно 100%
                  </p>
                )}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-warning/10 border border-warning/20 mb-6">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold mb-1">💡 Подсказка:</p>
                  <p className="text-muted-foreground">
                    Чем выше доля токена, тем больше он влияет на общий риск портфеля. 
                    USD обычно самый стабильный выбор.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setStep(2)}
                className="gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                Назад
              </Button>
              <Button
                size="lg"
                onClick={() => setStep(4)}
                disabled={totalAllocation !== 100}
                className="bg-gradient-to-r from-primary to-accent hover:opacity-90 gap-2"
              >
                Далее
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 4: Advanced Settings */}
        {step === 4 && (
          <Card className="modern-card p-8">
            <h2 className="text-2xl font-bold mb-6">Шаг 4: Дополнительные Настройки</h2>
            
            <div className="space-y-6 mb-6">
              {/* Auto Yield */}
              <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <Label className="text-lg font-semibold">Автоматическая Генерация Yield</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Неиспользуемые средства автоматически размещаются в протоколах для генерации дохода
                    </p>
                  </div>
                  <Switch
                    checked={autoYield}
                    onCheckedChange={setAutoYield}
                  />
                </div>
                {autoYield && (
                  <div className="mt-3 p-3 rounded-lg bg-success/10 border border-success/20 text-sm">
                    ✅ Ожидаемая доходность: 5-12% годовых
                  </div>
                )}
              </div>

              {/* Rebalance Threshold */}
              <div className="space-y-3">
                <Label className="text-lg font-semibold">Порог Ребалансировки</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[rebalanceThreshold]}
                    onValueChange={(v) => setRebalanceThreshold(v[0])}
                    min={1}
                    max={20}
                    step={1}
                    className="flex-1"
                  />
                  <div className="text-2xl font-bold w-16 text-right">{rebalanceThreshold}%</div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Ребалансировка запускается когда распределение отклоняется на {rebalanceThreshold}% от целевого
                </p>
                
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <button
                    onClick={() => setRebalanceThreshold(1)}
                    className={`p-3 rounded-lg text-sm ${rebalanceThreshold === 1 ? 'bg-primary/20 border-2 border-primary' : 'bg-secondary/30'}`}
                  >
                    <div className="font-bold">1%</div>
                    <div className="text-xs text-muted-foreground">Частая</div>
                  </button>
                  <button
                    onClick={() => setRebalanceThreshold(5)}
                    className={`p-3 rounded-lg text-sm ${rebalanceThreshold === 5 ? 'bg-primary/20 border-2 border-primary' : 'bg-secondary/30'}`}
                  >
                    <div className="font-bold">5%</div>
                    <div className="text-xs text-muted-foreground">Оптимально</div>
                  </button>
                  <button
                    onClick={() => setRebalanceThreshold(10)}
                    className={`p-3 rounded-lg text-sm ${rebalanceThreshold === 10 ? 'bg-primary/20 border-2 border-primary' : 'bg-secondary/30'}`}
                  >
                    <div className="font-bold">10%</div>
                    <div className="text-xs text-muted-foreground">Редкая</div>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-info/10 border border-info/20">
                <div className="flex items-start gap-2">
                  <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold mb-1">💡 Рекомендация:</p>
                    <p className="text-muted-foreground">
                      5% - оптимальный баланс между частотой ребалансировки и экономией на комиссиях.
                      Меньше = чаще ребалансировка (больше газа), больше = реже (выше риск отклонения).
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setStep(3)}
                className="gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                Назад
              </Button>
              <Button
                size="lg"
                onClick={handleCreate}
                disabled={loading || !treasuryName.trim() || totalAllocation !== 100}
                className="bg-gradient-to-r from-primary to-accent hover:opacity-90 gap-2 px-8"
              >
                {loading ? "Создание..." : "Создать Treasury"}
                <CheckCircle2 className="w-5 h-5" />
              </Button>
            </div>
          </Card>
        )}

        {/* Preview Box (always visible) */}
        {step > 1 && (
          <Card className="modern-card p-6 border-2 border-primary/30">
            <h3 className="font-semibold mb-4">Предпросмотр Treasury</h3>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-3xl">
                {selectedAvatar}
              </div>
              <div className="flex-1">
                <h4 className="text-xl font-bold">{treasuryName || "Имя не указано"}</h4>
                <p className="text-sm text-muted-foreground">
                  {allocations.USDC}% USDC • {allocations.EURC}% EURC • {allocations.XSGD}% XSGD
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs">
                  <span className="text-muted-foreground">
                    Yield: {autoYield ? "✅ Включен" : "❌ Выключен"}
                  </span>
                  <span className="text-muted-foreground">
                    Порог: {rebalanceThreshold}%
                  </span>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CreateTreasuryNew;

