import { callStructured, buildDatasetBlock, isAiAvailable } from './claude.service.js';
import { INSIGHT_SYSTEM_PROMPT } from '../prompts/insight.prompt.js';

const INSIGHT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    trends: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          metric: { type: 'string' },
          direction: { type: 'string', enum: ['up', 'down', 'flat'] },
          description: { type: 'string' },
        },
        required: ['metric', 'direction', 'description'],
        additionalProperties: false,
      },
    },
    anomalies: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          column: { type: 'string' },
          description: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['column', 'description', 'severity'],
        additionalProperties: false,
      },
    },
  },
  required: ['summary', 'trends', 'anomalies'],
  additionalProperties: false,
};

export async function generateInsights(sheetData) {
  if (!isAiAvailable()) {
    return { ...heuristicInsights(sheetData), source: 'fallback' };
  }
  const datasetBlock = buildDatasetBlock(sheetData);
  const userPrompt = `${datasetBlock}\n\nProduce structured insights following the schema.`;
  const result = await callStructured({
    systemPrompt: INSIGHT_SYSTEM_PROMPT,
    userPrompt,
    schema: INSIGHT_SCHEMA,
  });
  return { ...result, source: 'claude' };
}

function heuristicInsights(sheetData) {
  const rows = Array.isArray(sheetData) ? sheetData : [];
  const cols = rows[0] ? Object.keys(rows[0]) : [];
  return {
    summary: `Dataset has ${rows.length} rows across ${cols.length} columns. Set ANTHROPIC_API_KEY for AI-generated insights.`,
    trends: [],
    anomalies: [],
  };
}
