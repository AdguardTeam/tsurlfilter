/* eslint-disable no-console */
import { background } from './background';

background().catch((e) => console.log(e));
