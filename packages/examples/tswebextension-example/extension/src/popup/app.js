import React, { useEffect, useState } from 'react'
import { Formik } from 'formik'

import './app.css'

const rulesArrayToText = arr => arr.join('\n')
const rulesTextToArray = text => text.trim().split('\n').filter(el => el !== '')

export function App() {
    const [formValue, setFormValue] = useState({
        userrules: "",
        allowlist: "",
    })

    useEffect(() => {
        chrome.runtime.sendMessage(JSON.stringify({
            type: 'GET_CONFIG',
        }), (response) => {
            console.log(response)
            const { userrules, allowlist } = response.payload

            setFormValue({
                userrules: rulesArrayToText(userrules),
                allowlist: rulesArrayToText(allowlist),
            })
        })
    }, []);

    return (
        <Formik
            enableReinitialize={true}
            initialValues={formValue}
            onSubmit={values => {
                const payload = {
                    userrules: rulesTextToArray(values.userrules),
                    allowlist: rulesTextToArray(values.allowlist),
                }
                chrome.runtime.sendMessage(JSON.stringify({
                    type: 'SET_CONFIG',
                    payload,
                }), (response) => {
                    if (response.type === 'SET_CONFIG_FAIL') {
                        alert(response.payload)
                    }
                })
            }}
        >
            {({
                values,
                handleChange,
                handleSubmit,
            }) => (
                <form className="form" onSubmit={handleSubmit}>
                    <label>User rules</label>
                    <textarea
                        rows={10}
                        name="userrules"
                        id="userrules"
                        onChange={handleChange}
                        value={values.userrules}
                    />
                    <label>Allowlist</label>
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