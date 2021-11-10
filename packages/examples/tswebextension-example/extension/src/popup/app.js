import browser from 'webextension-polyfill'
import React from 'react'
import { Formik } from 'formik'

import './app.css'

export function App() {
    return (
        <Formik
            initialValues={{ userrules: 'example.org', allowlist: 'example.com' }}
            onSubmit={values => {
                browser.runtime.sendMessage(JSON.stringify(values))
            }}
        >
            {({
                values,
                handleChange,
                handleSubmit,
            }) => (
                <form className="form" onSubmit={handleSubmit}>
                    <label for="userrules">User rules</label>
                    <textarea
                        rows={10}
                        name="userrules"
                        id="userrules"
                        onChange={handleChange}
                        value={values.userrules}
                    />
                    <label for="allowlist">Allowlist</label>
                    <textarea
                        rows={10}
                        name="allowlist"
                        id="allowlist"
                        onChange={handleChange}
                        value={values.allowlist}
                    />
                    <button type="submit">
                        Load
                    </button>
                </form>
            )}
        </Formik>
    )
}