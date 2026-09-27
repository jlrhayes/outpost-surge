// OWNER: heroes agent. Overlay screens this module provides, keyed by id for openScreen(id, props).
import type { ComponentType } from 'preact';
import './heroes.css';
import { HeroesScreen } from './HeroesScreen';
import { HeroDetailScreen } from './HeroDetailScreen';
import { RecruitScreen } from './RecruitScreen';
import { FormationScreen } from './FormationScreen';
import { CampaignScreen } from './CampaignScreen';

export const heroScreens: Record<string, ComponentType<any>> = {
  heroes: HeroesScreen,
  heroDetail: HeroDetailScreen,
  recruit: RecruitScreen,
  formation: FormationScreen,
  campaign: CampaignScreen,
};
