import { AlertTriangle, Shield, Users, Coins, Mic } from 'lucide-react'
import { useGameStore } from '@/store/useGameStore'
import type { RiskEvent, RiskOption } from '@/types'

interface Props {
  event: RiskEvent
  onChoose: (option: RiskOption) => void
}

const optionIcons: Record<RiskOption['id'], typeof Shield> = {
  censor: Shield,
  cover: Users,
  bribe: Coins,
  ignore: Mic,
}

const optionColors: Record<RiskOption['id'], string> = {
  censor: 'from-tea/20 to-tea/5 border-tea/40 hover:border-tea',
  cover: 'from-gold/20 to-gold/5 border-gold/40 hover:border-gold',
  bribe: 'from-sandal/20 to-sandal/5 border-sandal/40 hover:border-sandal',
  ignore: 'from-cinnabar/20 to-cinnabar/5 border-cinnabar/40 hover:border-cinnabar',
}

export default function RiskEventModal({ event, onChoose }: Props) {
  const { gold } = useGameStore()

  return (
    <div className="fixed inset-0 bg-ink/70 z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="scroll-panel max-w-xl w-full animate-unroll border-2 border-cinnabar/50 shadow-2xl shadow-cinnabar/20">
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cinnabar/20 border-2 border-cinnabar mb-3 animate-shake">
            <AlertTriangle className="w-8 h-8 text-cinnabar" />
          </div>
          <h2 className="font-brush text-3xl text-cinnabar">巡查注意！</h2>
          <p className="text-sm text-ink-light mt-1">
            {event.hasOfficialPresent ? (
              <span className="text-cinnabar font-semibold">⚠️ 有官员在场，风险翻倍！</span>
            ) : (
              '说书内容引起了巡查注意'
            )}
          </p>
        </div>

        <div className="card-ancient mb-5 p-4">
          <div className="text-sm text-ink-light mb-2">敏感内容：</div>
          <div className="flex flex-wrap gap-2">
            {event.triggeredRiskTags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full bg-cinnabar/15 text-cinnabar text-sm font-medium border border-cinnabar/30"
              >
                ⚠️ {tag}
              </span>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-sandal/20 text-xs text-ink-light">
            基础风险值：<span className="text-cinnabar font-semibold">{event.basePatrolGain}</span>
            {event.hasOfficialPresent && <span className="text-cinnabar"> × 2（官员在场）</span>}
          </div>
        </div>

        <div className="space-y-2.5">
          {event.options.map((opt) => {
            const Icon = optionIcons[opt.id]
            const colorClass = optionColors[opt.id]
            const canAfford = gold >= opt.goldCost
            const disabled = !canAfford

            return (
              <button
                key={opt.id}
                onClick={() => !disabled && onChoose(opt)}
                disabled={disabled}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all bg-gradient-to-r ${colorClass} ${
                  disabled ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5 hover:shadow-md cursor-pointer'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-paper-dark/60 border border-sandal/20 flex-shrink-0">
                    <Icon className="w-5 h-5 text-sandal" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-brush text-lg text-sandal">{opt.text}</span>
                      {opt.goldCost > 0 && (
                        <span className={`text-sm font-semibold ${canAfford ? 'text-gold' : 'text-cinnabar'}`}>
                          💰 {opt.goldCost} 文
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-ink-light mb-2">{opt.description}</div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {opt.patrolDelta !== 0 && (
                        <span className={opt.patrolDelta < 0 ? 'text-tea' : 'text-cinnabar'}>
                          巡查 {opt.patrolDelta > 0 ? '+' : ''}{opt.patrolDelta}
                        </span>
                      )}
                      {opt.satisfactionDelta !== 0 && (
                        <span className={opt.satisfactionDelta > 0 ? 'text-tea' : 'text-cinnabar'}>
                          满意 {opt.satisfactionDelta > 0 ? '+' : ''}{opt.satisfactionDelta}
                        </span>
                      )}
                      {opt.reputationDelta !== 0 && (
                        <span className={opt.reputationDelta > 0 ? 'text-tea' : 'text-cinnabar'}>
                          声望 {opt.reputationDelta > 0 ? '+' : ''}{opt.reputationDelta}
                        </span>
                      )}
                      {disabled && (
                        <span className="text-cinnabar">金币不足</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
