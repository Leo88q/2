// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
let seq = 0;
export function makeRewardId(now = Date.now()): string {
  seq += 1;
  return `rw_${now.toString(36)}_${seq.toString(36)}`;
}
