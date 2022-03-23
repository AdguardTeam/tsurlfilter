import React, { useState, useEffect } from 'react';

import './app.css';

import { Message } from '../message';

const filtersList = [ 1, 2, 3, 4, 9, 14 ];

const sendMessage = (
    type: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any = null,
) => {
    return new Promise((resolve) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const callbackWrapper = (response: any) => {
            console.log(`Response for '${type}':`, response);
            resolve(response);
        };
        chrome.runtime.sendMessage({ type, data }, callbackWrapper);
    });
};

type ConfigAnswer = {
    status: boolean,
    filters: number[],
    rules: string[],
};

export function App() {
    const [isLoading, setIsLoading] = useState(true);
    const [isFilteringEnabled, setIsFilteringEnabled] = useState(false);
    const [userRules, setUserRules] = useState('');
    const [enabledFilters, setEnabledFilters] = useState<number[]>([]);

    useEffect(() => {
        const fetch = async () => {
            const {
                status,
                filters,
                rules,
            } = await sendMessage(Message.GET_CONFIG) as ConfigAnswer;

            setIsFilteringEnabled(status);
            setEnabledFilters(filters);
            setUserRules(rules?.join('\n'));

            setIsLoading(false);
        };

        fetch();
    }, []);

    const loader = <h1>Грузимся</h1>;
    if (isLoading) {
        return loader;
    }

    const onToggle = async () => {
        setIsLoading(true);

        const message = isFilteringEnabled
            ? Message.TURN_OFF
            : Message.TURN_ON;

        const status = await sendMessage(message) as boolean;
        setIsFilteringEnabled(status);

        setIsLoading(false);
    };

    const toggleBtn = (
        <button
            type="button"
            className='button'
            disabled={isLoading}
            onClick={onToggle}
        >
            <span className="text">
                { isFilteringEnabled ? 'Turn off' : 'Turn on'}
            </span>
        </button>
    );

    const updateUserRules = async () => {
        setIsLoading(true);

        await sendMessage(Message.APPLY_USER_RULES, userRules);

        setIsLoading(false);
    };

    const userRulesTextArea = (
        <>
            <label htmlFor='userrules'>User rules</label>
            <textarea
                id="userrules"
                name="userrules"
                rows={10}
                onChange={(e) => { setUserRules(e.target.value); }}
                value={userRules}
            />
            <button className='button' onClick={updateUserRules}>
                <span className="text">
                    Apply
                </span>
            </button>
        </>
    );

    const updateFilters = async (ids: number[]) => {
        setIsLoading(true);

        await sendMessage(Message.UPDATE_FILTERS, ids);

        setIsLoading(false);
        setEnabledFilters(ids);
    };

    const filters = filtersList.map(id => {
        const checked = enabledFilters.includes(id);

        const toggleFilter = () => {
            const updatedIds = checked
                ? enabledFilters.filter(i => i !== id)
                : enabledFilters.concat(id);
            updateFilters(updatedIds);
        };

        return (
            <div className='toggle-filter' key={id}>
                <label className="switch">
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={toggleFilter}
                    />
                    <span className="slider round"></span>
                </label>
                <p>Filter {id}</p>
            </div>
        );
    });

    const extra = (
        <>
            <br />
            <br />
            <div className='filters'>
                {filters}
            </div>
            <br />
            {userRulesTextArea}
        </>
    );

    return <>
        {toggleBtn}
        {isFilteringEnabled ? extra : ''}
    </>;
}
