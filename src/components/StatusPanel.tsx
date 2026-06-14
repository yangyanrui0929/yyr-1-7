import { Sun, Moon, Coins, Trophy, Calendar, Cloud, CloudRain, CloudSnow, AlertTriangle, Shield } from 'lucide-react'
import { useGameStore } from '@/store/useGameStore'
import type { Weather } from '@/types'

function WeatherIcon({ w }: { w: Weather }) {
  if (w === '晴') return <Sun className="w-5 h-5 text-gold" />
  if (w === '云') return <Cloud className="w-5 h-5 text-ink-light" />
  if (w === '雨') return <CloudRain className="w-5 h-5 text-tea" />
  if (w === '雪') return <CloudSnow className="w-5 h-5 text-sandal-light" />
  return null
}

export default function StatusPanel() {
  const { day, phase, gold, reputation, weather, patrolValue, bannedStoryIds } = useGameStore()

  return (
    <div className="scroll-panel mb-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-sandal" />
            <div>
              <div className="stat-label">第</div>
              <div className="stat-value flex items-baseline gap-1">
                {day}
                <span className="text-sm font-song text-ink-light">日</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {phase === 'day' ? (
              <Sun className="w-6 h-6 text-gold animate-breathe" />
            ) : (
              <Moon className="w-6 h-6 text-sandal animate-breathe" />
            )}
            <div>
              <div className="stat-label">时段</div>
              <div className="stat-value text-lg">
                {phase === 'day' ? '白日经营' : '夜晚开讲'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <WeatherIcon w={weather} />
            <div>
              <div className="stat-label">天气</div>
              <div className="stat-value text-lg">{weather}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Coins className="w-6 h-6 text-gold" />
            <div>
              <div className="stat-label">金币</div>
              <div className="stat-value text-gold font-semibold">{gold}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-cinnabar" />
            <div>
              <div className="stat-label">声望</div>
              <div className="flex items-center gap-2">
                <div className="stat-value text-cinnabar font-semibold">{reputation}</div>
                <div className="w-20 h-2 bg-paper-dark rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-gold to-cinnabar transition-all"
                    style={{ width: `${reputation}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {patrolValue >= 60 ? (
              <AlertTriangle className={`w-6 h-6 ${patrolValue >= 80 ? 'text-cinnabar animate-pulse' : 'text-gold'}`} />
            ) : (
              <Shield className="w-6 h-6 text-tea" />
            )}
            <div>
              <div className="stat-label">巡查值</div>
              <div className="flex items-center gap-2">
                <div className={`stat-value font-semibold ${patrolValue >= 80 ? 'text-cinnabar' : patrolValue >= 50 ? 'text-gold' : 'text-tea'}`}>
                  {patrolValue}
                </div>
                <div className="w-20 h-2 bg-paper-dark rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      patrolValue >= 80
                        ? 'bg-gradient-to-r from-cinnabar to-red-400'
                        : patrolValue >= 50
                        ? 'bg-gradient-to-r from-gold to-yellow-400'
                        : 'bg-gradient-to-r from-tea to-green-400'
                    }`}
                    style={{ width: `${patrolValue}%` }}
                  />
                </div>
              </div>
              {bannedStoryIds.length > 0 && (
                <div className="text-[10px text-cinnabar mt-0.5">已禁 {bannedStoryIds.length} 篇</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
