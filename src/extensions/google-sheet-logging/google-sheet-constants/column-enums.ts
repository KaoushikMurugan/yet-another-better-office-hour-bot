enum HelpSessionHeaders {
    StudentUsername = 'Student Username',
    StudentDiscordId = 'Student Discord ID',
    HelperUsername = 'Helper Username',
    HelperDiscordId = 'Helper Discord ID',
    SessionStartLocal = 'Session Start (Local Time)',
    SessionEndLocal = 'Session End (Local Time)',
    QueueName = 'Queue Name',
    WaitTimeMs = 'Wait Time (ms)',
    SessionStartUnix = 'Session Start (Unix Timestamp)',
    SessionEndUnix = 'Session End (Unix Timestamp)'
}

enum AttendanceHeaders {
    HelperUserName = 'Helper Username',
    TimeInLocal = 'Time In (Local Time)',
    TimeOutLocal = 'Time Out (Local Time)',
    HelpedStudents = 'Helped Students',
    HelperDiscordId = 'Helper Discord ID',
    OfficeHourTimeMs = 'Office Hour Time (ms)',
    ActiveTimeMs = 'Active Time (ms)',
    NumStudents = 'Number of Students Helped',
    UnixTimeIn = 'Time In (Unix Timestamp)',
    UnixTimeOut = 'Time Out (Unix Timestamp)'
}

const helpSessionHeaders = Object.values(HelpSessionHeaders);

const attendanceHeaders = Object.values(AttendanceHeaders);

export { HelpSessionHeaders, AttendanceHeaders, helpSessionHeaders, attendanceHeaders };
