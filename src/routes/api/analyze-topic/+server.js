import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';

const anthropic = new Anthropic({
  apiKey: env.CLAUDE_API_KEY,
});

export async function POST({ request }) {
  try {
    const { conversationText, previousTopics } = await request.json();

    const prompt = `Analyze the following conversation text and determine:
1. What is the main topic/theme being discussed?
2. Provide a short topic label (2-5 words)
3. Extract 3-5 key concepts or keywords
4. Compare this to previous topics: ${previousTopics.length > 0 ? previousTopics.map(t => t.label).join(', ') : 'none'}
5. Determine if this is a NEW topic or continues an existing topic (provide the matching topic label if continuing)
6. Assign semantic 2D coordinates (x, y) from -100 to 100 for this topic:
   - X-axis: Abstract/Conceptual (-100) vs Concrete/Practical (100)
   - Y-axis: Technical/Complex (-100) vs Simple/General (100)
   - Consider the semantic meaning and place the topic appropriately in this space

Conversation text:
"${conversationText}"

${previousTopics.length > 0 ? `Previous topics and their positions:
${previousTopics.map(t => `- "${t.label}" at (${t.x}, ${t.y})`).join('\n')}
Try to position this topic semantically close to related topics.` : ''}

Respond in JSON format:
{
  "isNewTopic": true/false,
  "matchingTopicLabel": "label if continuing existing topic, or null",
  "topicLabel": "short descriptive label",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "summary": "brief 1-sentence summary of what's being discussed",
  "x": number between -100 and 100,
  "y": number between -100 and 100
}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].text;

    // Try to parse JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from Claude response');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(analysis), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error analyzing topic:', error);
    return new Response(JSON.stringify({
      error: 'Failed to analyze topic',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
