using System;
using System.Collections.Generic;

public class Student
{
    public string StudentID { get; set; }
    public string Name { get; set; }
    public bool IsPresent { get; set; }

    public Student(string studentID, string name)
    {
        StudentID = studentID;
        Name = name;
        IsPresent = false;
    }

    public void MarkAttendance(bool attendance)
    {
        IsPresent = attendance;
    }

    public string AttendanceStatus
    {
        get { return IsPresent ? "Prent" : "Abs"; }
    }
}

public class AttendanceSystem
{
    private List<Student> students = new List<Student>();

    public void AddStudent(Student student)
    {
        students.Add(student);
    }

    public void DisplayAttendanceReport()
    {
        foreach (var student in students)
        {
            Console.WriteLine($"StudentID: {student.StudentID}, Name: {student.Name}, Attendance: {student.AttendanceStatus}");
        }
    }
}

class Program
{
    static void Main(string[] args)
    {
        var attendanceSystem = new AttendanceSystem();
        int numberOfStudents = Convert.ToInt32(Console.ReadLine());
        for (int i = 0; i < numberOfStudents; i++)
        {
            var studentDetails = Console.ReadLine().Split(' ');
            var student = new Student(studentDetails[0], studentDetails[1]);
            attendanceSystem.AddStudent(student);
            student.MarkAttendance(true);
        }
        attendanceSystem.DisplayAttendanceReport();
    }
}