import React from "react";
import { Button, Flex, Typography } from "antd";
import {
  ApartmentOutlined,
  FileTextOutlined,
  ProfileOutlined,
} from "@ant-design/icons";

const steps = [
  { key: "posting", title: "Đăng tin" },
  { key: "application", title: "Đơn ứng tuyển" },
  { key: "stages", title: "Giai đoạn" },
];

const iconMap = {
  posting: FileTextOutlined,
  application: ProfileOutlined,
  stages: ApartmentOutlined,
};

const JobSetupSteps = ({ currentStep, onChange }) => {
  return (
    <nav aria-label="Job setup steps" className="w-[220px]">
      <Flex vertical gap={20}>
        {steps.map((step) => {
          const isActive = step.key === currentStep;
          const Icon = iconMap[step.key];

          return (
            <Button
              key={step.key}
              block
              type="text"
              onClick={() => onChange(step.key)}
              className={`flex h-auto items-center justify-start rounded-xl border-0 px-3 py-3 text-left transition-all duration-200 ${
                isActive
                  ? "bg-[#FFF5F8] shadow-sm"
                  : "bg-white hover:bg-gray-50"
              }`}
            >
              <Flex align="center" gap={12} className="w-full">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-200 ${
                    isActive
                      ? "border-transparent bg-[#FF2E7E]"
                      : "border-[#D9D9D9] bg-white"
                  }`}
                >
                  <Icon
                    className={`text-lg ${
                      isActive ? "text-white" : "text-gray-400"
                    }`}
                  />
                </span>

                <Typography.Text
                  className={`text-sm ${
                    isActive
                      ? "font-semibold text-[#FF2E7E]"
                      : "font-medium text-gray-500"
                  }`}
                >
                  {step.title}
                </Typography.Text>
              </Flex>
            </Button>
          );
        })}
      </Flex>
    </nav>
  );
};

export default JobSetupSteps;
