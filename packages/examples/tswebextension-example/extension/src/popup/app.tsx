import React, { useEffect, useState } from 'react'
import { Formik } from 'formik'

import { MessageTypes } from '../common/message-types'

import './app.css'

const rulesArrayToText = (arr: string[]): string => arr.join('\n')
const rulesTextToArray = (text: string): string[] => text.trim().split('\n').filter(el => el !== '')

export function App() {
    const [formValue, setFormValue] = useState({
        userrules: "",
        allowlist: "",
    })

    useEffect(() => {
        chrome.runtime.sendMessage({
            type: MessageTypes.GET_CONFIG,
        }, (response) => {
            if(response?.payload){
                const { userrules, allowlist } = response.payload

                setFormValue({
                    userrules: rulesArrayToText(userrules),
                    allowlist: rulesArrayToText(allowlist),
                })
            }
        })
    }, []);

    const handleOpenAssistant = () => {
        chrome.runtime.sendMessage({
            type: MessageTypes.OPEN_ASSISTANT
        });

        return false;
    };

    const handleCloseAssistant = () => {
        chrome.runtime.sendMessage({
            type: MessageTypes.CLOSE_ASSISTANT
        });

        return false;
    };

    return (
        <Formik
            enableReinitialize={true}
            initialValues={formValue}
            onSubmit={values => {
                const payload = {
                    userrules: rulesTextToArray(values.userrules),
                    allowlist: rulesTextToArray(values.allowlist),
                }
                chrome.runtime.sendMessage({
                    type: MessageTypes.SET_CONFIG,
                    payload,
                }, (response) => {
                    if (response?.type === MessageTypes.SET_CONFIG_FAIL) {
                        alert(response?.payload)
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
                    <button type="button" onClick={handleOpenAssistant}>
                        Open assistant
                    </button>
                    <button type="button" onClick={handleCloseAssistant}>
                        Close assistant
                    </button>
                </form>
            )}
        </Formik>
    )
}
