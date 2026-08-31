/**
 * @file Redirects compatibility table data.
 *
 * During development/testing, this re-exports data from the main loader.
 * At build time, the Rollup plugin replaces this file with pre-serialized data.
 */

export { redirectsCompatibilityTableData } from './compatibility-table-data';
