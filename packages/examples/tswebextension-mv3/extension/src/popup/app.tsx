import React, { useState, useEffect } from 'react';

import './app.css';

import { Message } from '../message';
import { sendMessage } from '../common/send-message';
import { ConfigResponse } from '../background';

const filtersList = [ 1, 2, 3, 4, 9, 14 ];

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
            } = await sendMessage(Message.GetConfig) as ConfigResponse;

            setIsFilteringEnabled(status);
            setEnabledFilters(filters);
            setUserRules(rules?.join('\n'));

            setIsLoading(false);
        };

        fetch();
    }, []);

    const loader = <h1>Loading...</h1>;
    if (isLoading) {
        return loader;
    }

    const onToggle = async () => {
        setIsLoading(true);

        const message = isFilteringEnabled
            ? Message.TurnOff
            : Message.TurnOn;

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

        await sendMessage(Message.ApplyUserRules, userRules);

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

        await sendMessage(Message.UpdateFilters, ids);

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

    const filtersPanel = (
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

    const handleOpenAssistant = async () => {
        await sendMessage(Message.OpenAssistant);
    };

    const handleCloseAssistant = async () => {
        await sendMessage(Message.CloseAssistant);
    };

    const assistantPanel = (
        <>
            <button className='button' type="button" onClick={handleOpenAssistant}>
                <span className="text">
                    Open assistant
                </span>
            </button>
            <button className='button' type="button" onClick={handleCloseAssistant}>
                <span className="text">
                    Close assistant
                </span>
            </button>
        </>
    );

    return <>
        {toggleBtn}
        {isFilteringEnabled ? filtersPanel : ''}
        {isFilteringEnabled ? assistantPanel : ''}
    </>;
}
