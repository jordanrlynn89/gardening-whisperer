import { isVerbalConfirmation, isVerbalRejection } from '../lib/verbalConfirmation';

describe('verbalConfirmation', () => {
  describe('isVerbalConfirmation', () => {
    it('should detect simple affirmations', () => {
      expect(isVerbalConfirmation('yes')).toBe(true);
      expect(isVerbalConfirmation('Yeah')).toBe(true);
      expect(isVerbalConfirmation('sure')).toBe(true);
      expect(isVerbalConfirmation('okay')).toBe(true);
      expect(isVerbalConfirmation('ok')).toBe(true);
    });

    it('should detect photo-specific confirmations', () => {
      expect(isVerbalConfirmation('let me show you')).toBe(true);
      expect(isVerbalConfirmation("I'll take a picture")).toBe(true);
      expect(isVerbalConfirmation('let me take a photo')).toBe(true);
      expect(isVerbalConfirmation('here let me show you the plant')).toBe(true);
    });

    it('should handle case and punctuation variations', () => {
      expect(isVerbalConfirmation('Yes!')).toBe(true);
      expect(isVerbalConfirmation('SURE.')).toBe(true);
      expect(isVerbalConfirmation('  yeah  ')).toBe(true);
    });

    it('should detect affirmations at start of longer sentences', () => {
      expect(isVerbalConfirmation('okay how do I share the photo')).toBe(true);
      expect(isVerbalConfirmation('sure, I can do that')).toBe(true);
      expect(isVerbalConfirmation('yes please')).toBe(true);
      expect(isVerbalConfirmation('yeah that works')).toBe(true);
    });

    it('should reject non-confirmations', () => {
      expect(isVerbalConfirmation('no')).toBe(false);
      expect(isVerbalConfirmation('not now')).toBe(false);
      expect(isVerbalConfirmation('yesterday was nice')).toBe(false);
      expect(isVerbalConfirmation('I think so but maybe not')).toBe(false);
    });
  });

  describe('isVerbalRejection', () => {
    it('should detect simple rejections', () => {
      expect(isVerbalRejection('no')).toBe(true);
      expect(isVerbalRejection('nope')).toBe(true);
      expect(isVerbalRejection('nah')).toBe(true);
    });

    it('should detect deferred responses', () => {
      expect(isVerbalRejection('not now')).toBe(true);
      expect(isVerbalRejection('maybe later')).toBe(true);
      expect(isVerbalRejection('skip that')).toBe(true);
      expect(isVerbalRejection("let's skip this")).toBe(true);
    });

    it('should handle case and punctuation variations', () => {
      expect(isVerbalRejection('No!')).toBe(true);
      expect(isVerbalRejection('NOPE.')).toBe(true);
      expect(isVerbalRejection('  nah  ')).toBe(true);
    });

    it('should reject non-rejections', () => {
      expect(isVerbalRejection('yes')).toBe(false);
      expect(isVerbalRejection('sure')).toBe(false);
      expect(isVerbalRejection('I know what you mean')).toBe(false);
    });
  });
});
