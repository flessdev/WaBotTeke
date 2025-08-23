// commandEngine.js
const registry = {};

export function addCommands(commands) {
  Object.assign(registry, commands);
}

export async function dispatch(text, ctx) {
  for (const trigger in registry) {
    if (text.startsWith(trigger)) {
      const arg = text.slice(trigger.length).trim();
      return registry[trigger](ctx, arg);
    }
  }
  return false;
}
