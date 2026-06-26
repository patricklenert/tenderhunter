import { computeLayout, compileDescriptor } from 'boneyard-js';
import { writeFileSync, mkdirSync } from 'fs';

mkdirSync('./app/bones', { recursive: true });

// Dashboard stat grid: 4 stat cards in 2x2 grid
const statsGrid = {
  tag: 'div', className: 'stat-grid',
  children: [
    { tag: 'div', children: [{ tag: 'dt', text: 'Ausschreibungen' }, { tag: 'dd', text: '42' }] },
    { tag: 'div', children: [{ tag: 'dt', text: 'Firmen' }, { tag: 'dd', text: '3' }] },
    { tag: 'div', children: [{ tag: 'dt', text: 'Offene Aufgaben' }, { tag: 'dd', text: '12' }] },
    { tag: 'div', children: [{ tag: 'dt', text: 'Empfehlungen' }, { tag: 'dd', text: '8' }] },
  ]
};

const heroWin = { tag: 'span', text: '72 %' };
const heroKill = { tag: 'span', text: '2' };

const queueLanes = {
  tag: 'section', className: 'surface',
  children: [
    { tag: 'h2', text: 'Laufende Aufgaben' },
    { tag: 'ul', className: 'lane-list', children: [
      { tag: 'li', children: [
        { tag: 'div', className: 'lane-head', children: [
          { tag: 'span', text: 'Suche' },
          { tag: 'strong', text: '5' }
        ]},
        { tag: 'div', className: 'lane-track' }
      ]},
      { tag: 'li', children: [
        { tag: 'div', className: 'lane-head', children: [
          { tag: 'span', text: 'Bewerten' },
          { tag: 'strong', text: '3' }
        ]},
        { tag: 'div', className: 'lane-track' }
      ]},
    ]}
  ]
};

const recommendationsTable = {
  tag: 'section', className: 'surface',
  children: [
    { tag: 'h2', text: 'Empfehlungen' },
    { tag: 'div', className: 'table-wrap', children: [
      { tag: 'table', className: 'recommendation-table', children: [
        { tag: 'thead', children: [
          { tag: 'tr', children: [
            { tag: 'th', text: 'Ausschreibung' },
            { tag: 'th', text: 'Firma' },
            { tag: 'th', text: 'Passung' },
            { tag: 'th', text: 'Gewinnchance' },
            { tag: 'th', text: 'Status' },
          ]}
        ]},
        { tag: 'tbody', children: [
          { tag: 'tr', children: [
            { tag: 'td', text: 'Managed Service IT-Betrieb' },
            { tag: 'td', text: 'Palema Digital' },
            { tag: 'td', text: '85 %' },
            { tag: 'td', children: [
              { tag: 'div', className: 'score-cell', children: [
                { tag: 'span', text: '72 %' },
                { tag: 'div', className: 'score-track' }
              ]}
            ]},
            { tag: 'td', text: 'OK' },
          ]},
          { tag: 'tr', children: [
            { tag: 'td', text: 'Cloud Migration' },
            { tag: 'td', text: 'Palema Digital' },
            { tag: 'td', text: '68 %' },
            { tag: 'td', children: [
              { tag: 'div', className: 'score-cell', children: [
                { tag: 'span', text: '55 %' },
                { tag: 'div', className: 'score-track' }
              ]}
            ]},
            { tag: 'td', text: 'Stopp' },
          ]},
          { tag: 'tr', children: [
            { tag: 'td', text: 'Sicherheitsaudit' },
            { tag: 'td', text: 'Palema Digital' },
            { tag: 'td', text: '91 %' },
            { tag: 'td', children: [
              { tag: 'div', className: 'score-cell', children: [
                { tag: 'span', text: '88 %' },
                { tag: 'div', className: 'score-track' }
              ]}
            ]},
            { tag: 'td', text: 'OK' },
          ]},
        ]}
      ]}
    ]}
  ]
};

// Workflow skeletons
const pipelineOverview = {
  tag: 'dl', className: 'pipeline-overview',
  children: [
    { tag: 'div', children: [{ tag: 'dt', text: 'Warten' }, { tag: 'dd', text: '5' }] },
    { tag: 'div', children: [{ tag: 'dt', text: 'Laeuft' }, { tag: 'dd', text: '2' }] },
    { tag: 'div', children: [{ tag: 'dt', text: 'Fertig' }, { tag: 'dd', text: '10' }] },
    { tag: 'div', children: [{ tag: 'dt', text: 'Fehler' }, { tag: 'dd', text: '1' }] },
  ]
};

const jobFeed = {
  tag: 'div', className: 'job-feed-wrap',
  children: [
    { tag: 'div', className: 'job-feed-head', children: [
      { tag: 'h4', text: 'Aufgaben' },
      { tag: 'button', text: 'Aktualisieren' }
    ]},
    { tag: 'ul', className: 'job-feed', children: [
      { tag: 'li', children: [
        { tag: 'div', className: 'job-main', children: [
          { tag: 'strong', text: 'Suche' },
          { tag: 'span', text: 'Wartet' }
        ]}
      ]},
      { tag: 'li', children: [
        { tag: 'div', className: 'job-main', children: [
          { tag: 'strong', text: 'Bewerten' },
          { tag: 'span', text: 'Laeuft' }
        ]}
      ]},
      { tag: 'li', children: [
        { tag: 'div', className: 'job-main', children: [
          { tag: 'strong', text: 'Laden' },
          { tag: 'span', text: 'Fertig' }
        ]}
      ]},
    ]}
  ]
};

const recommendations = {
  tag: 'ul', className: 'recommend-list',
  children: [
    { tag: 'li', children: [
      { tag: 'div', className: 'recommend-top', children: [
        { tag: 'h4', text: 'Managed Service IT-Betrieb' },
        { tag: 'span', text: 'OK' }
      ]},
      { tag: 'dl', className: 'recommend-metrics', children: [
        { tag: 'div', children: [{ tag: 'dt', text: 'Passung' }, { tag: 'dd', text: '85 %' }] },
        { tag: 'div', children: [{ tag: 'dt', text: 'Chance' }, { tag: 'dd', text: '72 %' }] },
        { tag: 'div', children: [{ tag: 'dt', text: 'Aufwand' }, { tag: 'dd', text: '40 %' }] },
      ]},
      { tag: 'div', className: 'track-actions', children: [
        { tag: 'button', text: 'Merken' },
        { tag: 'button', text: 'Gewonnen' },
        { tag: 'button', text: 'Verloren' },
      ]}
    ]},
    { tag: 'li', children: [
      { tag: 'div', className: 'recommend-top', children: [
        { tag: 'h4', text: 'Cloud Migration' },
        { tag: 'span', text: 'Stopp' }
      ]},
      { tag: 'dl', className: 'recommend-metrics', children: [
        { tag: 'div', children: [{ tag: 'dt', text: 'Passung' }, { tag: 'dd', text: '68 %' }] },
        { tag: 'div', children: [{ tag: 'dt', text: 'Chance' }, { tag: 'dd', text: '55 %' }] },
        { tag: 'div', children: [{ tag: 'dt', text: 'Aufwand' }, { tag: 'dd', text: '60 %' }] },
      ]},
    ]}
  ]
};

const skeletons = [
  { name: 'hero-win', descriptor: heroWin, widths: [375, 768, 1280] },
  { name: 'hero-kill', descriptor: heroKill, widths: [375, 768, 1280] },
  { name: 'stats-grid', descriptor: statsGrid, widths: [375, 768, 1280] },
  { name: 'queue-lanes', descriptor: queueLanes, widths: [375, 768, 1280] },
  { name: 'recommendations-table', descriptor: recommendationsTable, widths: [375, 768, 1280] },
  { name: 'pipeline-overview', descriptor: pipelineOverview, widths: [375, 768, 1280] },
  { name: 'job-feed', descriptor: jobFeed, widths: [375, 768, 1280] },
  { name: 'recommendations', descriptor: recommendations, widths: [375, 768, 1280] },
];

const registryEntries = [];

for (const skel of skeletons) {
  const compiled = compileDescriptor(skel.descriptor);
  const responsive = {};
  for (const w of skel.widths) {
    const result = computeLayout(compiled, w);
    responsive[w] = result;
  }
  
  // Write individual bones file
  const bonesData = { breakpoints: responsive };
  writeFileSync(`./app/bones/${skel.name}.bones.json`, JSON.stringify(bonesData));
  
  registryEntries.push({ name: skel.name, bones: bonesData });
  
  // Log results
  for (const w of skel.widths) {
    const r = responsive[w];
    console.log(`  ${skel.name} @ ${w}px: ${r.bones.length} bones, ${r.width}x${r.height}`);
  }
}

// Write registry
const registryCode = `import { registerBones } from 'boneyard-js/react';

${registryEntries.map(e => `import ${e.name.replace(/-/g, '_')} from './${e.name}.bones.json';`).join('\n')}

${registryEntries.map(e => `registerBones('${e.name}', ${e.name.replace(/-/g, '_')});`).join('\n')}
`;

writeFileSync('./app/bones/registry.ts', registryCode);

console.log('\n✓ Bones generated and registry written to app/bones/');
