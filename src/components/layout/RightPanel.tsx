import { useState } from 'react'
import { EffectsPanel } from '../effects/EffectsPanel'
import { DocsPanel } from '../docs/DocsPanel'
import { MidiPanel } from '../midi/MidiPanel'
import { GamepadInput } from '../input/GamepadInput'
import { AgentLog } from '../agent/AgentLog'

type Tab = 'effects' | 'docs' | 'midi' | 'gamepad' | 'agent'

export function RightPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('effects')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'effects', label: 'FX' },
    { id: 'docs', label: 'Docs' },
    { id: 'midi', label: 'MIDI' },
    { id: 'gamepad', label: 'Input' },
    { id: 'agent', label: 'Agent' },
  ]

  return (
    <div className="flex flex-col h-full bg-bg-surface border-l border-border w-full md:w-64 md:min-w-64">
      {/* Tab bar */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-2 py-2 text-[10px] font-medium uppercase tracking-wider transition-colors ${
              activeTab === tab.id
                ? 'text-accent border-b-2 border-accent'
                : 'text-text-muted hover:text-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'effects' && <EffectsPanel />}
        {activeTab === 'docs' && <DocsPanel />}
        {activeTab === 'midi' && <MidiPanel />}
        {activeTab === 'gamepad' && <GamepadInput />}
        {activeTab === 'agent' && <AgentLog />}
      </div>
    </div>
  )
}
