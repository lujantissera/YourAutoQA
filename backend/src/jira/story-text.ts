import type { UserStory } from '../agent/ports.js';

// Convierte la historia de Jira en el único texto que recibe el grafo (`usText`).
// Cada parte opcional se añade solo si existe, así nunca quedan líneas en blanco de más.
export function storyToPrompt(story: UserStory): string {
  const parts = [`${story.key}: ${story.summary}`];
  if (story.description) parts.push(story.description);
  if (story.acceptanceCriteria) parts.push(`Criterios de aceptación:\n${story.acceptanceCriteria}`);
  return parts.join('\n\n');
}
