import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  GameState,
  Weather,
  Seat,
  Story,
  StoryBranch,
  InterruptionOption,
  LedgerRecord,
  StoryRecord,
  ReputationHistory,
  RiskEvent,
  RiskOption,
} from '@/types'
import { STORIES } from '@/data/stories'
import { initSnacks } from '@/data/snacks'
import { initSeats } from '@/data/seats'
import { initRenovations, getUpgradeCost } from '@/data/renovations'
import { INTERRUPTIONS } from '@/data/interruptions'
import { generateRandomCustomers } from '@/data/customers'
import { calcSettlement } from '@/utils/settlement'

const WEATHERS: Weather[] = ['晴', '晴', '晴', '云', '云', '雨', '雪']

function randomWeather(): Weather {
  return WEATHERS[Math.floor(Math.random() * WEATHERS.length)]
}

function pickRandomStories(count: number, bannedIds: string[]): Story[] {
  const pool = STORIES.filter((s) => !bannedIds.includes(s.id))
  const result: Story[] = []
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length)
    result.push(pool.splice(idx, 1)[0])
  }
  return result
}

function uid(): string {
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function buildRiskOptions(hasOfficial: boolean): RiskOption[] {
  return [
    {
      id: 'censor',
      text: '删改桥段',
      description: '临时删去敏感内容，故事热度下降但风险降低',
      patrolDelta: -12,
      satisfactionDelta: -10,
      goldCost: 0,
      reputationDelta: 0,
    },
    {
      id: 'cover',
      text: '请熟客遮掩',
      description: '请老熟客帮忙打圆场，分散巡查注意',
      patrolDelta: -8,
      satisfactionDelta: -3,
      goldCost: 20,
      reputationDelta: 0,
    },
    {
      id: 'bribe',
      text: '贿请通融',
      description: '塞些银子给巡查人员，破财消灾',
      patrolDelta: -20,
      satisfactionDelta: 0,
      goldCost: hasOfficial ? 120 : 60,
      reputationDelta: -3,
    },
    {
      id: 'ignore',
      text: '照讲不误',
      description: '无视风险继续说书，巡查值大幅上涨',
      patrolDelta: hasOfficial ? 25 : 15,
      satisfactionDelta: 5,
      goldCost: 0,
      reputationDelta: 2,
    },
  ]
}

function generateRiskEvent(
  story: Story,
  branch: StoryBranch,
  hasOfficial: boolean
): RiskEvent | null {
  if (branch.riskTags.length === 0) return null
  return {
    id: `risk-${Date.now()}`,
    storyId: story.id,
    branchId: branch.id,
    triggeredRiskTags: branch.riskTags,
    basePatrolGain: branch.riskValue,
    hasOfficialPresent: hasOfficial,
    options: buildRiskOptions(hasOfficial),
  }
}

const initialState: GameState = {
  day: 1,
  phase: 'day',
  gold: 200,
  reputation: 30,
  weather: '晴',
  snacks: initSnacks(),
  seats: initSeats(),
  renovations: initRenovations(),
  customers: [],
  currentStory: null,
  currentBranch: null,
  storyProgress: 0,
  availableStories: [],
  interruptions: INTERRUPTIONS,
  currentInterruption: null,
  performanceActive: false,
  ledger: [],
  storyHistory: [],
  reputationHistory: [],
  lastStoryDay: {},
  storyScores: {},
  isSettlement: false,
  lastSettlement: null,
  patrolValue: 0,
  bannedStoryIds: [],
  currentRiskEvent: null,
  seizedGold: 0,
}

interface GameActions {
  buySnack: (snackId: string, qty: number) => void
  moveSeat: (seatId: number, x: number, y: number) => void
  upgradeRenovation: (renoId: string) => void
  switchToNight: () => void
  selectStory: (storyId: string, branchId: string) => void
  startPerformance: () => void
  tickPerformance: () => void
  handleInterruption: (option: InterruptionOption) => void
  handleRiskEvent: (option: RiskOption) => void
  doSettlement: () => void
  nextDay: () => void
  resetGame: () => void
  addLedgerRecord: (type: LedgerRecord['type'], category: string, amount: number, note: string) => void
}

export const useGameStore = create<GameState & GameActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      buySnack: (snackId: string, qty: number) => {
        const state = get()
        const snack = state.snacks.find((s) => s.id === snackId)
        if (!snack) return
        const totalCost = snack.cost * qty
        if (state.gold < totalCost) return
        const newStock = Math.min(snack.maxStock, snack.stock + qty)
        const actualQty = newStock - snack.stock
        if (actualQty <= 0) return
        const actualCost = snack.cost * actualQty

        set((s) => ({
          gold: s.gold - actualCost,
          snacks: s.snacks.map((x) =>
            x.id === snackId ? { ...x, stock: newStock } : x
          ),
        }))
        get().addLedgerRecord('支出', '茶点采购', actualCost, `采购${snack.name} x${actualQty}`)
      },

      moveSeat: (seatId: number, x: number, y: number) => {
        set((s) => ({
          seats: s.seats.map((seat) =>
            seat.id === seatId ? { ...seat, x, y } : seat
          ),
        }))
      },

      upgradeRenovation: (renoId: string) => {
        const state = get()
        const reno = state.renovations.find((r) => r.id === renoId)
        if (!reno || reno.level >= reno.maxLevel) return
        const cost = getUpgradeCost(reno)
        if (state.gold < cost) return

        const repGain = reno.bonusReputation

        set((s) => ({
          gold: s.gold - cost,
          reputation: Math.min(100, s.reputation + repGain),
          renovations: s.renovations.map((r) =>
            r.id === renoId ? { ...r, level: r.level + 1 } : r
          ),
          reputationHistory: [
            ...s.reputationHistory,
            {
              day: s.day,
              value: Math.min(100, s.reputation + repGain),
              delta: repGain,
              reason: `装修升级：${reno.name}`,
            },
          ],
        }))
        get().addLedgerRecord('支出', '装修升级', cost, `升级${reno.name}至${reno.level + 1}级`)
      },

      switchToNight: () => {
        const state = get()
        const weather = state.weather
        let customerCount = 6
        if (weather === '雨') customerCount = Math.max(2, customerCount - 3)
        if (weather === '雪') customerCount = Math.max(2, customerCount - 4)
        if (weather === '云') customerCount = Math.max(3, customerCount - 1)
        if (state.reputation > 50) customerCount += 2
        if (state.reputation > 80) customerCount += 2

        const customers = generateRandomCustomers(customerCount)
        const seats = [...state.seats].map((s) => ({ ...s, occupied: false }))
        const sortedSeats = [...seats].sort((a, b) => {
          const order: Record<Seat['tier'], number> = { 贵宾: 0, 雅座: 1, 普通: 2 }
          return order[a.tier] - order[b.tier]
        })
        for (let i = 0; i < Math.min(customers.length, sortedSeats.length); i++) {
          const seat = sortedSeats[i]
          customers[i].seatId = seat.id
          const idx = seats.findIndex((s) => s.id === seat.id)
          if (idx >= 0) seats[idx].occupied = true
        }

        const availableStories = pickRandomStories(3, state.bannedStoryIds)

        set({
          phase: 'night',
          customers,
          seats,
          availableStories,
          currentStory: null,
          currentBranch: null,
          storyProgress: 0,
          performanceActive: false,
          currentInterruption: null,
          currentRiskEvent: null,
        })
      },

      selectStory: (storyId: string, branchId: string) => {
        const state = get()
        const story = state.availableStories.find((s) => s.id === storyId)
        const branch = story?.branches.find((b) => b.id === branchId)
        if (!story || !branch) return
        set({ currentStory: story, currentBranch: branch, storyProgress: 0 })
      },

      startPerformance: () => {
        const state = get()
        if (!state.currentStory || !state.currentBranch) return
        set({ performanceActive: true, storyProgress: 0 })
      },

      tickPerformance: () => {
        const state = get()
        if (!state.performanceActive) return

        const newProgress = Math.min(100, state.storyProgress + 4)

        if (!state.currentRiskEvent && !state.currentInterruption && state.currentStory && state.currentBranch) {
          const riskTriggerChance = 0.12 + (state.currentBranch.riskValue / 100) * 0.2
          if (state.storyProgress > 15 && state.storyProgress < 95 && Math.random() < riskTriggerChance) {
            const hasOfficial = state.customers.some((c) => c.seatId !== null && c.type === '官员')
            const riskEvent = generateRiskEvent(state.currentStory, state.currentBranch, hasOfficial)
            if (riskEvent) {
              set({ currentRiskEvent: riskEvent, storyProgress: newProgress })
              return
            }
          }
        }

        if (!state.currentInterruption && Math.random() < 0.18 && state.storyProgress > 10 && state.storyProgress < 90) {
          const seatedCustomers = state.customers.filter((c) => c.seatId !== null)
          if (seatedCustomers.length > 0) {
            const c = seatedCustomers[Math.floor(Math.random() * seatedCustomers.length)]
            const matching = state.interruptions.filter((i) => i.customerType === c.type)
            const pool = matching.length > 0 ? matching : state.interruptions
            const ev = pool[Math.floor(Math.random() * pool.length)]
            set({ currentInterruption: ev, storyProgress: newProgress })
            return
          }
        }

        const customers = state.customers.map((c) => {
          if (c.seatId === null) return c
          let delta = Math.random() < 0.7 ? 1 : -1
          if (state.currentStory && state.currentBranch) {
            const match = state.currentBranch.tags.some((t) => c.preferenceTags.includes(t))
            if (match) delta += 1
          }
          return { ...c, satisfaction: Math.max(0, Math.min(100, c.satisfaction + delta)) }
        })

        if (newProgress >= 100) {
          set({ performanceActive: false, storyProgress: 100, customers })
          setTimeout(() => get().doSettlement(), 600)
        } else {
          set({ storyProgress: newProgress, customers })
        }
      },

      handleInterruption: (option: InterruptionOption) => {
        const state = get()
        if (!state.currentInterruption) return

        const customers = state.customers.map((c) => ({
          ...c,
          satisfaction: Math.max(0, Math.min(100, c.satisfaction + option.satisfactionEffect)),
        }))

        const newReputation = Math.max(0, Math.min(100, state.reputation + option.reputationEffect))

        set({
          currentInterruption: null,
          customers,
          gold: state.gold + option.goldEffect,
          reputation: newReputation,
        })

        if (option.goldEffect !== 0) {
          get().addLedgerRecord(
            option.goldEffect > 0 ? '收入' : '支出',
            '插话应对',
            Math.abs(option.goldEffect),
            option.text.slice(0, 20)
          )
        }

        if (option.reputationEffect !== 0) {
          set((s) => ({
            reputationHistory: [
              ...s.reputationHistory,
              {
                day: s.day,
                value: newReputation,
                delta: option.reputationEffect,
                reason: option.reputationEffect > 0 ? '插话应对得当' : '插话处理失当',
              },
            ],
          }))
        }
      },

      handleRiskEvent: (option: RiskOption) => {
        const state = get()
        if (!state.currentRiskEvent) return

        if (state.gold < option.goldCost) return

        const multiplier = state.currentRiskEvent.hasOfficialPresent ? 2 : 1
        const patrolDelta = option.patrolDelta * (option.patrolDelta > 0 ? multiplier : 1)
        const newPatrol = Math.max(0, Math.min(100, state.patrolValue + patrolDelta))

        const customers = state.customers.map((c) => ({
          ...c,
          satisfaction: Math.max(0, Math.min(100, c.satisfaction + option.satisfactionDelta)),
        }))

        const newReputation = Math.max(0, Math.min(100, state.reputation + option.reputationDelta))

        set({
          currentRiskEvent: null,
          patrolValue: newPatrol,
          customers,
          gold: state.gold - option.goldCost,
          reputation: newReputation,
        })

        if (option.goldCost > 0) {
          get().addLedgerRecord(
            '支出',
            option.id === 'bribe' ? '贿赂巡查' : '打点熟客',
            option.goldCost,
            option.text
          )
        }

        if (option.reputationDelta !== 0) {
          set((s) => ({
            reputationHistory: [
              ...s.reputationHistory,
              {
                day: s.day,
                value: newReputation,
                delta: option.reputationDelta,
                reason: option.reputationDelta > 0 ? `冒险说书：${option.text}` : `处置风险：${option.text}`,
              },
            ],
          }))
        }
      },

      doSettlement: () => {
        const state = get()
        if (!state.currentStory || !state.currentBranch) return

        let endingPatrol = state.patrolValue
        let isBanned = false
        let seizedGold = 0

        if (endingPatrol >= 80) {
          isBanned = true
          seizedGold = Math.min(state.gold, Math.floor(state.gold * 0.4))
          endingPatrol = Math.max(0, endingPatrol - 40)
        } else if (endingPatrol >= 60) {
          seizedGold = Math.min(state.gold, Math.floor(state.gold * 0.15))
          endingPatrol = Math.max(0, endingPatrol - 20)
        }

        const result = calcSettlement(
          state.day,
          state.currentStory,
          state.currentBranch,
          state.customers,
          state.seats,
          state.renovations,
          state.storyHistory,
          state.lastStoryDay,
          state.storyScores,
          state.reputation,
          state.snacks,
          endingPatrol,
          isBanned,
          seizedGold
        )

        const storyRecord: StoryRecord = {
          day: state.day,
          storyId: state.currentStory.id,
          branchId: state.currentBranch.id,
          audienceCount: result.audienceCount,
          earnings: result.totalEarnings,
          avgSatisfaction: result.avgSatisfaction,
        }

        const newStoryScores = { ...state.storyScores }
        if (!newStoryScores[state.currentStory.id]) {
          newStoryScores[state.currentStory.id] = []
        }
        newStoryScores[state.currentStory.id] = [
          ...newStoryScores[state.currentStory.id],
          result.avgSatisfaction,
        ].slice(-10)

        const newBannedIds = isBanned && !state.bannedStoryIds.includes(state.currentStory.id)
          ? [...state.bannedStoryIds, state.currentStory.id]
          : state.bannedStoryIds

        const newRep = Math.max(0, Math.min(100, state.reputation + result.reputationDelta - (isBanned ? 10 : 0)))

        const repHistory: ReputationHistory = {
          day: state.day,
          value: newRep,
          delta: result.reputationDelta - (isBanned ? 10 : 0),
          reason: isBanned ? '故事遭禁，声名受损' : result.reputationDelta >= 0 ? '说书好评' : '差评影响',
        }

        set((s) => ({
          isSettlement: true,
          lastSettlement: result,
          gold: Math.max(0, s.gold + result.totalEarnings - seizedGold),
          reputation: newRep,
          storyHistory: [...s.storyHistory, storyRecord],
          lastStoryDay: { ...s.lastStoryDay, [state.currentStory!.id]: state.day },
          storyScores: newStoryScores,
          reputationHistory: [...s.reputationHistory, repHistory],
          patrolValue: endingPatrol,
          bannedStoryIds: newBannedIds,
          seizedGold,
        }))

        get().addLedgerRecord('收入', '基础门票', result.baseEarnings, '晚场门票')
        if (result.tasteMatchBonus > 0)
          get().addLedgerRecord('收入', '口味匹配', result.tasteMatchBonus, '故事对味')
        if (result.seatViewBonus > 0)
          get().addLedgerRecord('收入', '视野加成', result.seatViewBonus, '座位优良')
        if (result.storyHeatBonus > 0)
          get().addLedgerRecord('收入', '热度加成', result.storyHeatBonus, '故事热门')
        if (result.serialExpectBonus > 0)
          get().addLedgerRecord('收入', '连载期待', result.serialExpectBonus, '观众期待')
        if (result.tips > 0)
          get().addLedgerRecord('收入', '客人打赏', result.tips, '客人满意打赏')
        if (result.snackRevenue > 0)
          get().addLedgerRecord('收入', '茶点售卖', result.snackRevenue, '消费茶点')
        if (result.badReviewPenalty > 0)
          get().addLedgerRecord('支出', '差评损失', result.badReviewPenalty, '客人不满索赔')
        if (seizedGold > 0)
          get().addLedgerRecord('支出', isBanned ? '查禁扣银' : '巡查罚银', seizedGold, isBanned ? '故事遭禁，扣押账银' : '巡查罚没')
      },

      nextDay: () => {
        set((s) => ({
          day: s.day + 1,
          phase: 'day',
          weather: randomWeather(),
          customers: [],
          currentStory: null,
          currentBranch: null,
          storyProgress: 0,
          availableStories: [],
          performanceActive: false,
          currentInterruption: null,
          currentRiskEvent: null,
          isSettlement: false,
          seizedGold: 0,
          seats: s.seats.map((seat) => ({ ...seat, occupied: false })),
          patrolValue: Math.max(0, s.patrolValue - 10),
        }))
      },

      resetGame: () => {
        set({ ...initialState, weather: randomWeather() })
      },

      addLedgerRecord: (type, category, amount, note) => {
        set((s) => ({
          ledger: [
            ...s.ledger,
            {
              day: s.day,
              id: uid(),
              type,
              category,
              amount,
              note,
              timestamp: Date.now(),
            },
          ],
        }))
      },
    }),
    {
      name: 'teahouse-storyteller-save',
      partialize: (s) => ({
        day: s.day,
        gold: s.gold,
        reputation: s.reputation,
        snacks: s.snacks,
        seats: s.seats,
        renovations: s.renovations,
        ledger: s.ledger,
        storyHistory: s.storyHistory,
        reputationHistory: s.reputationHistory,
        lastStoryDay: s.lastStoryDay,
        storyScores: s.storyScores,
        patrolValue: s.patrolValue,
        bannedStoryIds: s.bannedStoryIds,
      }),
    }
  )
)
