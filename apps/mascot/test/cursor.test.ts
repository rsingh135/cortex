import { expect, it } from 'vitest';
import { cursorTilt } from '../src/renderer/lib/cursor';
it('follows nearby cursors and caps distant or invalid desktop coordinates', () => {
  expect(cursorTilt(0,0)).toEqual({x:0,y:0});
  expect(cursorTilt(120,-120)).toEqual({x:4.5,y:-3});
  expect(cursorTilt(10000,-10000)).toEqual({x:9,y:-6});
  expect(cursorTilt(NaN,Infinity)).toEqual({x:0,y:0});
});
