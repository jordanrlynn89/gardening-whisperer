/**
 * @jest-environment node
 */

/**
 * Tests for the /api/analyze-photo route.
 *
 * Covers:
 *  - Successful photo analysis (mocking Gemini API)
 *  - Missing imageData returns 400
 *  - Invalid/empty request body
 *  - Conversation context trimming (5000 char limit)
 *  - Gemini API error handling (sanitized errors in production)
 *  - Image size limit (10 MB)
 *  - Valid base64 image data handling (data-URL stripping, JPEG mime type)
 *
 * Uses @jest-environment node so that native Node.js Web API globals
 * (Request, Response, Headers) are available — NextRequest requires them.
 */

// ---------------------------------------------------------------------------
// Mock the @google/genai SDK before any imports that reference it
// ---------------------------------------------------------------------------
const mockGenerateContent = jest.fn();
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent,
    },
  })),
}));

import { POST } from '../app/api/analyze-photo/route';
import { NextRequest } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a NextRequest that POSTs JSON to the analyze-photo endpoint. */
function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3003/api/analyze-photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('/api/analyze-photo', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    // Provide a valid API key by default; individual tests can override
    process.env = {
      ...originalEnv,
      GEMINI_API_KEY: 'test-key-abc123',
      NODE_ENV: 'test',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // -----------------------------------------------------------------------
  // 1. Successful photo analysis
  // -----------------------------------------------------------------------
  describe('successful analysis', () => {
    it('returns 200 with analysis text from Gemini', async () => {
      const analysisText =
        'I can see a tomato plant with yellowing lower leaves, which is likely nitrogen deficiency.';
      mockGenerateContent.mockResolvedValueOnce({ text: analysisText });

      const req = createRequest({ imageData: 'c29tZWJhc2U2NA==' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.analysis).toBe(analysisText);
    });

    it('calls GoogleGenAI constructor with the configured API key', async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: 'Healthy plant.' });

      const req = createRequest({ imageData: 'base64data' });
      await POST(req);

      expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: 'test-key-abc123' });
    });

    it('calls generateContent exactly once per request', async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: 'Analysis.' });

      const req = createRequest({ imageData: 'base64data' });
      await POST(req);

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('uses gemini-3-flash-preview model', async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: 'Analysis.' });

      const req = createRequest({ imageData: 'base64data' });
      await POST(req);

      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs.model).toBe('gemini-3-flash-preview');
    });

    it('sends the image as JPEG inlineData', async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: 'Analysis.' });

      const req = createRequest({ imageData: 'base64data' });
      await POST(req);

      const callArgs = mockGenerateContent.mock.calls[0][0];
      const imagePart = callArgs.contents[0].parts[1];
      expect(imagePart.inlineData.mimeType).toBe('image/jpeg');
      expect(imagePart.inlineData.data).toBe('base64data');
    });

    it('includes the photo analysis system prompt in the text part', async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: 'Analysis.' });

      const req = createRequest({ imageData: 'base64data' });
      await POST(req);

      const callArgs = mockGenerateContent.mock.calls[0][0];
      const textPart = callArgs.contents[0].parts[0].text;
      expect(textPart).toContain('plant diagnosis assistant');
      expect(textPart).toContain('Overall health');
    });
  });

  // -----------------------------------------------------------------------
  // 2. Missing imageData returns 400
  // -----------------------------------------------------------------------
  describe('missing imageData', () => {
    it('returns 400 when imageData key is absent', async () => {
      const req = createRequest({});
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/required/i);
    });

    it('returns 400 when imageData is null', async () => {
      const req = createRequest({ imageData: null });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('returns 400 when imageData is empty string', async () => {
      const req = createRequest({ imageData: '' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('does not call Gemini API when imageData is missing', async () => {
      const req = createRequest({});
      await POST(req);

      expect(mockGenerateContent).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 3. Invalid / empty request body
  // -----------------------------------------------------------------------
  describe('invalid request body', () => {
    it('returns 400 when body has unrelated keys but no imageData', async () => {
      const req = createRequest({ photo: 'some-data', other: 42 });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/required/i);
    });

    it('returns 400 when imageData is undefined', async () => {
      const req = createRequest({ imageData: undefined as unknown as string });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // 4. Conversation context trimming (5000 char limit)
  // -----------------------------------------------------------------------
  describe('conversation context handling', () => {
    it('appends conversationContext to the prompt when provided', async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: 'Contextual analysis.' });

      const context = 'User said: my basil has brown spots on the leaves';
      const req = createRequest({
        imageData: 'base64data',
        conversationContext: context,
      });
      await POST(req);

      const callArgs = mockGenerateContent.mock.calls[0][0];
      const prompt = callArgs.contents[0].parts[0].text as string;
      expect(prompt).toContain('Conversation so far');
      expect(prompt).toContain('basil has brown spots');
      expect(prompt).toContain("what's most relevant to the user's concerns");
    });

    it('truncates context that exceeds 5000 characters', async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: 'Result.' });

      // Build context: known prefix + padding to exceed 5000 chars
      const marker = 'MARKER_AT_END';
      const longContext =
        'A'.repeat(5000 - marker.length) + marker + 'B'.repeat(5000);

      const req = createRequest({
        imageData: 'base64data',
        conversationContext: longContext,
      });
      await POST(req);

      const prompt = mockGenerateContent.mock.calls[0][0].contents[0].parts[0]
        .text as string;

      // The context is sliced at 5000 chars, so the marker (which starts at
      // position 5000-12) should be present but the trailing Bs should not.
      expect(prompt).toContain('MARKER_AT_END');
      expect(prompt).not.toContain('BBBBB');
    });

    it('uses exactly 5000 characters from a context longer than 5000', async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: 'Result.' });

      const longContext = 'X'.repeat(8000);
      const req = createRequest({
        imageData: 'base64data',
        conversationContext: longContext,
      });
      await POST(req);

      const prompt = mockGenerateContent.mock.calls[0][0].contents[0].parts[0]
        .text as string;

      // Count the X characters that appear in the prompt
      const xCount = (prompt.match(/X/g) ?? []).length;
      expect(xCount).toBe(5000);
    });

    it('does not append context section when conversationContext is omitted', async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: 'No context analysis.' });

      const req = createRequest({ imageData: 'base64data' });
      await POST(req);

      const prompt = mockGenerateContent.mock.calls[0][0].contents[0].parts[0]
        .text as string;
      expect(prompt).not.toContain('Conversation so far');
    });

    it('ignores non-string conversationContext (number)', async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: 'Analysis.' });

      const req = createRequest({
        imageData: 'base64data',
        conversationContext: 99999,
      });
      await POST(req);

      const prompt = mockGenerateContent.mock.calls[0][0].contents[0].parts[0]
        .text as string;
      expect(prompt).not.toContain('Conversation so far');
    });

    it('ignores non-string conversationContext (object)', async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: 'Analysis.' });

      const req = createRequest({
        imageData: 'base64data',
        conversationContext: { messages: ['hello'] },
      });
      await POST(req);

      const prompt = mockGenerateContent.mock.calls[0][0].contents[0].parts[0]
        .text as string;
      expect(prompt).not.toContain('Conversation so far');
    });

    it('ignores non-string conversationContext (boolean)', async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: 'Analysis.' });

      const req = createRequest({
        imageData: 'base64data',
        conversationContext: true,
      });
      await POST(req);

      const prompt = mockGenerateContent.mock.calls[0][0].contents[0].parts[0]
        .text as string;
      expect(prompt).not.toContain('Conversation so far');
    });
  });

  // -----------------------------------------------------------------------
  // 5. Gemini API error handling (sanitized errors in production)
  // -----------------------------------------------------------------------
  describe('Gemini API error handling', () => {
    it('returns 500 with sanitized message when Gemini throws (non-dev)', async () => {
      (process.env as Record<string, string>).NODE_ENV = 'test';
      mockGenerateContent.mockRejectedValueOnce(
        new Error('RESOURCE_EXHAUSTED: quota exceeded')
      );

      const req = createRequest({ imageData: 'base64data' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Photo analysis failed');
      // Ensure the real error message is NOT exposed
      expect(data.error).not.toContain('RESOURCE_EXHAUSTED');
    });

    it('returns detailed error message in development mode', async () => {
      (process.env as Record<string, string>).NODE_ENV = 'development';
      mockGenerateContent.mockRejectedValueOnce(
        new Error('Model not found: gemini-3-flash-preview')
      );

      const req = createRequest({ imageData: 'base64data' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Model not found: gemini-3-flash-preview');
    });

    it('returns sanitized message in production even for Error instances', async () => {
      (process.env as Record<string, string>).NODE_ENV = 'production';
      mockGenerateContent.mockRejectedValueOnce(
        new Error('Internal server error from upstream')
      );

      const req = createRequest({ imageData: 'base64data' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe('Photo analysis failed');
    });

    it('returns sanitized message when non-Error object is thrown', async () => {
      // Some SDK versions throw plain strings or objects
      mockGenerateContent.mockRejectedValueOnce('unexpected string error');

      const req = createRequest({ imageData: 'base64data' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe('Photo analysis failed');
    });

    it('returns sanitized message even in dev when thrown value is not an Error', async () => {
      (process.env as Record<string, string>).NODE_ENV = 'development';
      mockGenerateContent.mockRejectedValueOnce({ code: 'INVALID_API_KEY' });

      const req = createRequest({ imageData: 'base64data' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      // Non-Error object: the code path falls through to the generic message
      expect(data.error).toBe('Photo analysis failed');
    });

    it('returns 500 when Gemini returns empty string analysis', async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: '' });

      const req = createRequest({ imageData: 'base64data' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/no analysis/i);
    });

    it('returns 500 when Gemini returns null text', async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: null });

      const req = createRequest({ imageData: 'base64data' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/no analysis/i);
    });

    it('returns 500 when Gemini returns undefined text', async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: undefined });

      const req = createRequest({ imageData: 'base64data' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.success).toBe(false);
    });

    it('returns 500 when GEMINI_API_KEY is not set', async () => {
      delete process.env.GEMINI_API_KEY;

      const req = createRequest({ imageData: 'base64data' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('GEMINI_API_KEY');
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 6. Image size limit (10 MB)
  // -----------------------------------------------------------------------
  describe('image size limit', () => {
    it('returns 413 when imageData exceeds 10 MB', async () => {
      const oversized = 'A'.repeat(10 * 1024 * 1024 + 1);
      const req = createRequest({ imageData: oversized });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(413);
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/too large/i);
    });

    it('accepts imageData that is exactly 10 MB', async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: 'Analysis.' });

      const exactLimit = 'A'.repeat(10 * 1024 * 1024);
      const req = createRequest({ imageData: exactLimit });
      const res = await POST(req);

      expect(res.status).toBe(200);
    });

    it('does not call Gemini API when image is too large', async () => {
      const oversized = 'A'.repeat(10 * 1024 * 1024 + 100);
      const req = createRequest({ imageData: oversized });
      await POST(req);

      expect(mockGenerateContent).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 7. Valid base64 image data handling
  // -----------------------------------------------------------------------
  describe('base64 image data handling', () => {
    it('strips data URL prefix (data:image/jpeg;base64,...)', async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: 'Analysis.' });

      const req = createRequest({
        imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      });
      const res = await POST(req);

      expect(res.status).toBe(200);

      const callArgs = mockGenerateContent.mock.calls[0][0];
      const imagePart = callArgs.contents[0].parts[1];
      expect(imagePart.inlineData.data).toBe('/9j/4AAQSkZJRg==');
    });

    it('strips data URL prefix for PNG images', async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: 'Analysis.' });

      const req = createRequest({
        imageData: 'data:image/png;base64,iVBORw0KGgo=',
      });
      await POST(req);

      const callArgs = mockGenerateContent.mock.calls[0][0];
      const imagePart = callArgs.contents[0].parts[1];
      expect(imagePart.inlineData.data).toBe('iVBORw0KGgo=');
    });

    it('passes raw base64 through unchanged when no data URL prefix', async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: 'Analysis.' });

      const rawBase64 = '/9j/4AAQSkZJRg==';
      const req = createRequest({ imageData: rawBase64 });
      await POST(req);

      const callArgs = mockGenerateContent.mock.calls[0][0];
      const imagePart = callArgs.contents[0].parts[1];
      expect(imagePart.inlineData.data).toBe(rawBase64);
    });

    it('always sends mimeType as image/jpeg regardless of input format', async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: 'Analysis.' });

      const req = createRequest({
        imageData: 'data:image/webp;base64,UklGR...',
      });
      await POST(req);

      const callArgs = mockGenerateContent.mock.calls[0][0];
      const imagePart = callArgs.contents[0].parts[1];
      expect(imagePart.inlineData.mimeType).toBe('image/jpeg');
    });

    it('sends contents with user role containing text and image parts', async () => {
      mockGenerateContent.mockResolvedValueOnce({ text: 'Analysis.' });

      const req = createRequest({ imageData: 'base64data' });
      await POST(req);

      const callArgs = mockGenerateContent.mock.calls[0][0];
      const contents = callArgs.contents;

      expect(contents).toHaveLength(1);
      expect(contents[0].role).toBe('user');
      expect(contents[0].parts).toHaveLength(2);
      expect(contents[0].parts[0]).toHaveProperty('text');
      expect(contents[0].parts[1]).toHaveProperty('inlineData');
    });
  });
});
