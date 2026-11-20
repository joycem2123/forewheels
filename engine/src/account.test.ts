import { cleanUsername, emailOk, looksLikeEmail, passwordOk, USERNAME_RULE } from './account';
import { newMember, paymentMethods, seed } from './backend';

describe('account rules', () => {
  it('needs all five password rules', () => {
    expect(passwordOk('Short1!')).toBe(false);
    expect(passwordOk('longenough1!')).toBe(false); // no uppercase
    expect(passwordOk('Longenough1!')).toBe(true);
  });

  it('cleans usernames as they are typed', () => {
    expect(cleanUsername('Alex Smith!')).toBe('alexsmith');
    expect(USERNAME_RULE.test('al')).toBe(false);
    expect(USERNAME_RULE.test('alex_smith.2')).toBe(true);
  });

  it('tells emails from usernames', () => {
    expect(looksLikeEmail('alex@example.com')).toBe(true);
    expect(looksLikeEmail('@alex')).toBe(false);
    expect(emailOk('alex@example')).toBe(false);
  });
});

describe('new members', () => {
  it('start on pay as you go with nothing booked', () => {
    const d = newMember({ firstName: ' Sam ', vehicle: { label: 'Mazda CX-5', plate: '', size: 'suv' } });
    expect(d.member.firstName).toBe('Sam');
    expect(d.member.plan).toBe('payg');
    expect(d.bookings).toHaveLength(0);
    expect(d.member.card).toBeNull();
  });

  it('only offer the club account when a member number is set', () => {
    expect(paymentMethods(newMember({ firstName: 'Sam' }).member)).toEqual(['apple']);
    expect(paymentMethods(newMember({ firstName: 'Sam', memberNo: '12' }).member)).toEqual(['club', 'apple']);
    expect(paymentMethods(seed().member)).toEqual(['club', 'apple', 'card']);
  });
});
