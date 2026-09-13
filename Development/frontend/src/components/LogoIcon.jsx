import React from 'react';
import Icon from '@ant-design/icons';

const LogoIcon = ({ size = 36, color = '#5D8C3E', className, style, ...props }) => {
  const LogoSvg = (svgProps) => (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" {...svgProps}>
      <rect width="48" height="48" rx="12" />
      <path
        d="M14 16C14 14.8954 14.8954 14 16 14H32C33.1046 14 34 14.8954 34 16V32C34 33.1046 33.1046 34 32 34H16C14.8954 34 14 33.1046 14 32V16Z"
        stroke="white"
        strokeWidth="2"
      />
      <path
        d="M20 22L24 26L28 22"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M24 18V26"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );

  return (
    <Icon 
      component={LogoSvg} 
      style={{ fontSize: size, color, ...style }} 
      className={className}
      {...props} 
    />
  );
};

export default LogoIcon;
