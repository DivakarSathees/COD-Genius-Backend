using System; using System.Collections.Generic; using System.Linq;
public class Patient {
  public string PatientId { get; set; }
  public string Name { get; set; }
  public string DateOfBirth { get; set; }
  public string ContactNumber { get; set; }
  public Patient(string patientId, string name, string dateOfBirth, string contactNumber) {
    PatientId = patientId;
    Name = name;
    DateOfBirth = dateOfBirth;
    ContactNumber = contactNumber;
  }
}
public class HospitalPatientManagementSystem {
  private List<Patient> patients = new List<Patient>();
  public void AddPatient(Patient patient) {
    patients.Add(patient);
  }
  public void RemovePatient(string patientId) {
    patients = patients.Where(p => p.PatientId != patientId).ToList();
  }
  public Patient SearchPatientById(string patientId) {
    return patients.FirstOrDefault(p => p.PatientId == patientId);
  }
  public List<Patient> SearchPatientsByName(string name) {
    return patients.Where(p => p.Name.Contains(name)).ToList();
  }
  public List<Patient> SearchPatientsByDateOfBirth(string dateOfBirth) {
    return patients.Where(p => p.DateOfBirth == dateOfBirth).ToList();
  }
  public void PrintPatients() {
    foreach (var patient in patients) {
      Console.WriteLine($"Patient ID: {patient.PatientId}, Name: {patient.Name}, Date of Birth: {patient.DateOfBirth}, Contact Number: {patient.ContactNumber}");
    }
  }
}
class Program {
  static void Main() {
    var system = new HospitalPatientManagementSystem();
    int numberOfPatients = Convert.ToInt32(Console.ReadLine());
    for (int i = 0; i < numberOfPatients; i++) {
      string[] patientDetails = Console.ReadLine().Split(',');
      var patient = new Patient(patientDetails[0], patientDetails[1], patientDetails[2], patientDetails[3]);
      system.AddPatient(patient);
    }
    system.PrintPatients();
  }
}