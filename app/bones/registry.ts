import { registerBones } from 'boneyard-js/react';

import hero_win from './hero-win.bones.json';
import hero_kill from './hero-kill.bones.json';
import stats_grid from './stats-grid.bones.json';
import queue_lanes from './queue-lanes.bones.json';
import recommendations_table from './recommendations-table.bones.json';
import pipeline_overview from './pipeline-overview.bones.json';
import job_feed from './job-feed.bones.json';
import recommendations from './recommendations.bones.json';

registerBones({
  'hero-win': hero_win as any,
  'hero-kill': hero_kill as any,
  'stats-grid': stats_grid as any,
  'queue-lanes': queue_lanes as any,
  'recommendations-table': recommendations_table as any,
  'pipeline-overview': pipeline_overview as any,
  'job-feed': job_feed as any,
  'recommendations': recommendations as any,
});
