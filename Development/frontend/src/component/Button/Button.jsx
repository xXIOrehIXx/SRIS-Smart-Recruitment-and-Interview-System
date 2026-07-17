import React from 'react';
import './Button.css';

const Button = ({ children, type = 'primary', onClick, className = '' }) => {
  return (
    <button className={`btn btn-${type} ${className}`} onClick={onClick}>
      {children}
    </button>
  );
};

export default Button;