import { useState, useEffect } from 'react'
import { getActivityLog, onActivityLogChange } from '../../engine/webmcp'

export function AgentLog() {
  const [log, setLog] = useState(getActivityLog())

  useEffect(() => {
    return onActivityLogChange(() => setLog([...getActivityLog()]))
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-border">
        <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">Agent Activity</h3>
        <p className="text-[9px] text-text-muted mt-0.5">
          {('modelContext' in navigator) ? 'WebMCP active' : 'WebMCP not available'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {log.length === 0 ? (
          <div className="px-3 py-4 text-xs text-text-muted text-center">
            No agent activity yet. When a browser AI agent calls tools, their activity will appear here.
          </div>
        ) : (
          log.map((entry, i) => (
            <div key={i} className="px-3 py-2 border-b border-border/30">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${entry.status === 'success' ? 'bg-success' : 'bg-error'}`} />
                <span className="text-[10px] text-accent font-mono">{entry.tool}</span>
                <span className="text-[9px] text-text-muted ml-auto">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-[9px] text-text-muted mt-0.5 truncate">{entry.result}</p>
              {Object.keys(entry.params).length > 0 && (
                <p className="text-[9px] text-text-muted font-mono mt-0.5 truncate">
                  {JSON.stringify(entry.params)}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
