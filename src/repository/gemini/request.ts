import { Type } from '@google/genai';
import type { RecognitionRequest } from '../RecognitionRepository';
// JSON Schema for image analysis
export const analysisResponseSchema = {
  type: Type.OBJECT,
  properties: {
    isRecognizable: {
      type: Type.BOOLEAN,
      description: 'Set to true if there are clear, identifiable everyday objects in the photo. Set to false if the photo is pitch black, completely blurred, solid blank color, out of focus, or lacks any distinct objects.',
    },
    unrecognizableReason: {
      type: Type.STRING,
      description: 'If isRecognizable is false, provide a friendly reason in Traditional Chinese, e.g. "照片光線過於昏暗", "畫面模糊難以辨識主體", "純色背景無具體物品"',
    },
    photographyTips: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '2 to 3 practical tips in Traditional Chinese to help the user capture identifiable objects next time',
    },
    sceneTitle: {
      type: Type.STRING,
      description: 'Short catchy Traditional Chinese title of the scene, e.g. 悠閒午後的咖啡館, 充滿活力的辦公桌, 繁忙熱鬧的城市街頭',
    },
    sceneDescription: {
      type: Type.STRING,
      description: '1-sentence friendly Traditional Chinese description of what is happening in the picture',
    },
    items: {
      type: Type.ARRAY,
      description: 'Up to 8 clearly identifiable objects, items, or elements for practical English learning. Return fewer for simple scenes. Empty if not recognizable.',
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: 'Unique snake_case identifier, e.g. coffee_cup, laptop, green_plant',
          },
          word: {
            type: Type.STRING,
            description: 'English word or key phrase, e.g. coffee, laptop, plant, latte art, chair',
          },
          chinese: {
            type: Type.STRING,
            description: 'Traditional Chinese translation, e.g. 咖啡, 筆記型電腦, 植栽, 拿鐵拉花, 椅子',
          },
          phonetic: {
            type: Type.STRING,
            description: 'Accurate IPA phonetic transcription, e.g. /ˈkɔːfi/, /ˈlæp.tɑːp/',
          },
          partOfSpeech: {
            type: Type.STRING,
            description: 'Traditional Chinese part of speech label, e.g. 名詞, 動詞, 形容詞',
          },
          definition: {
            type: Type.STRING,
            description: 'Concise, conversational Traditional Chinese explanation for learners',
          },
          exampleEn: {
            type: Type.STRING,
            description: 'Everyday, natural English example sentence containing the word',
          },
          exampleZh: {
            type: Type.STRING,
            description: 'Traditional Chinese translation of the example sentence',
          },
          collocations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '2 to 3 practical collocations or phrase patterns, e.g. ["a cup of coffee", "hot coffee", "drink coffee"]',
          },
          emoji: {
            type: Type.STRING,
            description: 'Single best matching emoji symbol, e.g. ☕, 💻, 🪴, 🪑, 📱',
          },
          boundingBox: {
            type: Type.OBJECT,
            description: 'Bounds of the ENTIRE visible object, including all extremities, in image percentages 0–100 from the top-left. Never return only a distinctive part. For broad surfaces (table, wall, floor), bound the whole visible surface; use the full image when it extends across the scene.',
            properties: {
              left: { type: Type.NUMBER, description: 'Left edge percentage, 0–100' },
              top: { type: Type.NUMBER, description: 'Top edge percentage, 0–100' },
              right: { type: Type.NUMBER, description: 'Right edge percentage, greater than left, up to 100' },
              bottom: { type: Type.NUMBER, description: 'Bottom edge percentage, greater than top, up to 100' },
            },
            required: ['left', 'top', 'right', 'bottom'],
          },
          position: {
            type: Type.OBJECT,
            properties: {
              x: {
                type: Type.NUMBER,
                description: 'Horizontal marker anchor on a visible, unobstructed part of this object, percentage strictly between 8 and 92. For surfaces, avoid placing it on foreground objects.',
              },
              y: {
                type: Type.NUMBER,
                description: 'Vertical marker anchor on a visible, unobstructed part of this object, percentage strictly between 12 and 88. Independent of boundingBox.',
              },
            },
            required: ['x', 'y'],
          },
        },
        required: [
          'id',
          'word',
          'chinese',
          'phonetic',
          'partOfSpeech',
          'definition',
          'exampleEn',
          'exampleZh',
          'collocations',
          'emoji',
          'position',
          'boundingBox',
        ],
      },
    },
  },
  required: ['isRecognizable', 'items'],
};


export function makeRequest(input: RecognitionRequest) {
  let binary = '';
  for (let start = 0; start < input.bytes.length; start += 8192) binary += String.fromCharCode(...input.bytes.subarray(start, start + 8192));
  return {
    contents: [{ inlineData: { data: btoa(binary), mimeType: input.mimeType } }, { text:
      `You are an ESL tutor. Analyze the photo for everyday objects. Return isRecognizable=false, a reason and photographyTips for blurry, dark or empty images. Otherwise identify up to ${input.maxItems} clear objects; return fewer when only a few are visible. Include English words, IPA, part of speech, definitions, natural examples, collocations and emoji. For each object return boundingBox {left,top,right,bottom} in image percentages 0–100 covering the ENTIRE visible object. For scissors include both the tips and all handles, not just the blade or hinge. Do not add crop padding; the app adds it. For broad surfaces such as tables, walls or floors include the whole visible extent, using the full image bounds when appropriate. Separately return a position marker (x:8-92%, y:12-88%) on a visible, unobstructed part of that object; a table marker must be on the tabletop, not on scissors resting on it. All translations and descriptions must use ${input.language} Traditional Chinese (Taiwan). Do not invent objects.` }],
    schema: analysisResponseSchema,
  };
}
