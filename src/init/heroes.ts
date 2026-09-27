// OWNER: heroes agent. Side-effect registrations for this module, imported once at startup:
// registerTicker(...), registerBonusProvider(...), registerPowerProvider(...), on('event', ...).
import { registerPowerProvider } from '../core/bonuses';
import { registerHeroGrantHandler } from '../core/economy';
import { registerHeroLookup } from '../ui/components/ItemIcon';
import { heroDef } from '../data/heroes';
import { addShardsIn, allHeroesPower, grantHeroIn } from '../systems/heroes';

// Hero power (level, stars, gear, skills) of every owned hero. Troops are counted by meta ('troops').
registerPowerProvider('heroes', (s) => allHeroesPower(s));

// Reward.heroes -> new hero (or shards if owned); Reward.heroShards -> shards (10 unlock an unowned hero).
registerHeroGrantHandler((s, reward) => {
  for (const id of reward.heroes ?? []) grantHeroIn(s, id);
  for (const [id, n] of Object.entries(reward.heroShards ?? {})) addShardsIn(s, id, n);
});

// Lets meta's reward tiles show real hero names/rarities.
registerHeroLookup((id) => {
  const d = heroDef(id);
  return d ? { name: d.name, rarity: d.rarity, icon: 'hero' } : undefined;
});
