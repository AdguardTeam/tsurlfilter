import React from 'react';
import ReactDOM from 'react-dom';

import { DebuggingApp } from './DebuggingApp';

try {
    ReactDOM.render(
        <DebuggingApp />,
        document.getElementById('root'),
    );
} catch (error) {
    console.error(error);
}
