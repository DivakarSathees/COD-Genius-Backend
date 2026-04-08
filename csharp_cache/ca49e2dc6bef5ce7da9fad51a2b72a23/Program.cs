using System;
using System.Collections.Generic;

public class Employee
{
    public string EmployeeID { get; set; }
    public string Name { get; set; }
    public string Department { get; set; }
}

public class EmployeeManagementSystem
{
    private List<Employee> employees = new List<Employee>();

    public void AddEmployee(Employee employee)
    {
        employees.Add(employee);
    }

    public void ViewEmployees()
    {
        foreach (var employee in employees)
        {
            Console.WriteLine($"EmployeeID: {employee.EmployeeID}, Name: {employee.Name}, Department: {employee.Department}");
        }
    }
}

class Program
{
    static void Main(string[] args)
    {
        int numEmployees = Convert.ToInt32(Console.ReadLine());
        EmployeeManagementSystem ems = new EmployeeManagementSystem();

        for (int i = 0; i < numEmployees; i++)
        {
            string[] employeeDetails = Console.ReadLine().Split(' ');
            Employee employee = new Employee
            {
                EmployeeID = employeeDetails[0],
                Name = employeeDetails[1],
                Department = employeeDetails[2]
            };
            ems.AddEmployee(employee);
        }
        ems.ViewEmployees();
    }
}